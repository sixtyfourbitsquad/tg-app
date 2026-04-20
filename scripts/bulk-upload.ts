#!/usr/bin/env -S npx tsx
/**
 * Bulk-upload .mp4 files from a local folder into the videos store.
 *
 * Usage:
 *   npx tsx scripts/bulk-upload.ts /path/to/videos/folder
 *
 * For every *.mp4 file in the folder it will:
 *   1. Skip if size > MAX_SIZE_BYTES.
 *   2. Skip if a Video row already exists with the same original_filename.
 *   3. Copy the file into $VIDEOS_DIR (no-op if already there / same size).
 *   4. Insert a Video row with url=/videos/<filename>.
 *
 * Env:
 *   DATABASE_URL       required (Prisma)
 *   VIDEOS_DIR         defaults to /home/adii/videos
 *   BULK_MAX_SIZE_MB   overrides the 15MB skip threshold
 *   BULK_BATCH_SIZE    overrides the batch size (default 50)
 */
import "dotenv/config";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const MAX_SIZE_MB = Number(process.env.BULK_MAX_SIZE_MB ?? 15);
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const BATCH_SIZE = Math.max(1, Number(process.env.BULK_BATCH_SIZE ?? 50));
const VIDEOS_DIR = resolve(process.env.VIDEOS_DIR ?? "/home/adii/videos");

type Candidate = {
  source: string;
  filename: string;
  size: number;
};

type SkipReason = "too_large" | "duplicate" | "unsupported_ext";

type Outcome =
  | { kind: "added"; filename: string }
  | { kind: "skipped"; filename: string; reason: SkipReason; detail?: string }
  | { kind: "error"; filename: string; detail: string };

function usage(code: number): never {
  const msg =
    "Usage: npx tsx scripts/bulk-upload.ts <folder>\n" +
    "  folder   directory containing .mp4 files to import";
  if (code === 0) console.log(msg);
  else console.error(msg);
  process.exit(code);
}

function banner(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function scanFolder(folder: string): Candidate[] {
  const entries = readdirSync(folder, { withFileTypes: true });
  const out: Candidate[] = [];
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (extname(ent.name).toLowerCase() !== ".mp4") continue;
    const source = join(folder, ent.name);
    let size = 0;
    try {
      size = statSync(source).size;
    } catch {
      continue;
    }
    out.push({ source, filename: ent.name, size });
  }
  out.sort((a, b) => a.filename.localeCompare(b.filename));
  return out;
}

function copyIfNeeded(source: string, dest: string, size: number): void {
  if (source === dest) return;
  if (existsSync(dest)) {
    try {
      if (statSync(dest).size === size) return; // already there, same size
    } catch {
      /* fall through and overwrite */
    }
  }
  copyFileSync(source, dest);
}

async function existingFilenames(
  db: PrismaClient,
  names: string[],
): Promise<Set<string>> {
  if (names.length === 0) return new Set();
  const rows = await db.video.findMany({
    where: { original_filename: { in: names } },
    select: { original_filename: true },
  });
  return new Set(rows.map((r) => r.original_filename));
}

async function processOne(
  db: PrismaClient,
  c: Candidate,
  alreadyInDb: Set<string>,
): Promise<Outcome> {
  if (c.size > MAX_SIZE_BYTES) {
    return {
      kind: "skipped",
      filename: c.filename,
      reason: "too_large",
      detail: `${humanBytes(c.size)} > ${MAX_SIZE_MB} MB`,
    };
  }
  if (alreadyInDb.has(c.filename)) {
    return { kind: "skipped", filename: c.filename, reason: "duplicate" };
  }

  const dest = join(VIDEOS_DIR, c.filename);
  try {
    copyIfNeeded(c.source, dest, c.size);
  } catch (err) {
    return {
      kind: "error",
      filename: c.filename,
      detail: `copy failed: ${(err as Error).message}`,
    };
  }

  const title = basename(c.filename, extname(c.filename));
  try {
    await db.video.create({
      data: {
        url: `/videos/${c.filename}`,
        thumbnail: "",
        title,
        file_path: dest,
        file_size: BigInt(c.size),
        original_filename: c.filename,
      },
    });
  } catch (err) {
    return {
      kind: "error",
      filename: c.filename,
      detail: `db insert failed: ${(err as Error).message}`,
    };
  }

  return { kind: "added", filename: c.filename };
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg || arg === "-h" || arg === "--help") usage(arg ? 0 : 1);

  const folder = resolve(arg);
  let stat;
  try {
    stat = statSync(folder);
  } catch (err) {
    console.error(`Cannot read ${folder}: ${(err as Error).message}`);
    process.exit(1);
  }
  if (!stat.isDirectory()) {
    console.error(`Not a directory: ${folder}`);
    process.exit(1);
  }

  if (!existsSync(VIDEOS_DIR)) {
    mkdirSync(VIDEOS_DIR, { recursive: true });
    console.log(`Created VIDEOS_DIR at ${VIDEOS_DIR}`);
  }

  banner("bulk-upload");
  console.log(`source       ${folder}`);
  console.log(`destination  ${VIDEOS_DIR}`);
  console.log(`max size     ${MAX_SIZE_MB} MB`);
  console.log(`batch size   ${BATCH_SIZE}`);

  const candidates = scanFolder(folder);
  if (candidates.length === 0) {
    console.log("\nNo .mp4 files found. Nothing to do.");
    return;
  }
  console.log(`\nFound ${candidates.length} .mp4 file(s).`);

  const db = new PrismaClient({ log: ["error", "warn"] });

  const tallies = { added: 0, skipped: 0, errors: 0 };
  const errors: { filename: string; detail: string }[] = [];
  const skips: Record<SkipReason, number> = {
    too_large: 0,
    duplicate: 0,
    unsupported_ext: 0,
  };

  try {
    let processed = 0;
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);

      // One-shot lookup of existing rows for this batch keeps DB round-trips low.
      const alreadyInDb = await existingFilenames(
        db,
        batch.map((c) => c.filename),
      );

      const results = await Promise.all(
        batch.map((c) => processOne(db, c, alreadyInDb)),
      );

      for (const r of results) {
        if (r.kind === "added") tallies.added++;
        else if (r.kind === "skipped") {
          tallies.skipped++;
          skips[r.reason]++;
          if (r.reason === "too_large") {
            console.log(`  skip  ${r.filename}  (${r.detail ?? "too large"})`);
          }
        } else {
          tallies.errors++;
          errors.push({ filename: r.filename, detail: r.detail });
          console.error(`  error ${r.filename}  ${r.detail}`);
        }
      }

      processed += batch.length;
      console.log(
        `progress  ${processed}/${candidates.length}  ` +
          `(+${tallies.added} added, ${tallies.skipped} skipped, ${tallies.errors} errors)`,
      );
    }
  } finally {
    await db.$disconnect();
  }

  banner("summary");
  console.log(`total     ${candidates.length}`);
  console.log(`added     ${tallies.added}`);
  console.log(
    `skipped   ${tallies.skipped}  ` +
      `(too_large=${skips.too_large}, duplicate=${skips.duplicate})`,
  );
  console.log(`errors    ${tallies.errors}`);
  if (errors.length > 0) {
    console.log("\nerrors:");
    for (const e of errors) console.log(`  - ${e.filename}: ${e.detail}`);
  }

  process.exit(tallies.errors > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error("bulk-upload failed:", err);
  process.exit(1);
});
