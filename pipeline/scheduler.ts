import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import {
  getRedgifsToken,
  fetchRedgifsVideos,
  processGif,
} from "./reddit";
import { logger } from "../lib/logger";

const prisma = new PrismaClient();
const CRON_SCHEDULE = process.env.PIPELINE_CRON ?? "0 */6 * * *";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(
  token: string,
  tag: string,
  limit: number,
  retries = 3
): Promise<Awaited<ReturnType<typeof fetchRedgifsVideos>>> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchRedgifsVideos(token, tag, limit);
    } catch (err: unknown) {
      const status =
        (err as { response?: { status?: number } })?.response?.status;
      if (status === 429 && attempt < retries) {
        const wait = attempt * 5000; // 5s, 10s, 15s
        logger.warn(`Rate limited on "${tag}", retrying in ${wait}ms (attempt ${attempt}/${retries})`);
        await sleep(wait);
      } else {
        throw err;
      }
    }
  }
  throw new Error("Unreachable");
}

function tagToSlug(tag: string): string {
  return tag.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

async function resolveOrCreateCategory(tag: string): Promise<string> {
  const slug = tagToSlug(tag);
  const cat = await prisma.category.upsert({
    where: { slug },
    update: {},
    create: { name: tag, slug },
  });
  return cat.id;
}

export async function runPipeline(): Promise<{
  status: "success" | "partial" | "failed";
  videos_fetched: number;
  errors: string[];
}> {
  const tags = (process.env.REDGIFS_SEARCH_TAGS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const limit = parseInt(process.env.PIPELINE_LIMIT ?? "25", 10);
  const errors: string[] = [];
  let videos_fetched = 0;

  if (tags.length === 0) {
    logger.error("REDGIFS_SEARCH_TAGS not configured");
    return { status: "failed", videos_fetched: 0, errors: ["No search tags configured"] };
  }

  logger.info("Pipeline started", { tags, limit });

  let token: string;
  try {
    token = await getRedgifsToken();
    logger.info("Redgifs token obtained");
  } catch (err) {
    const msg = `Redgifs auth failed: ${err instanceof Error ? err.message : err}`;
    logger.error(msg);
    await prisma.pipelineLog.create({
      data: { status: "failed", videos_fetched: 0, errors: [msg] },
    });
    return { status: "failed", videos_fetched: 0, errors: [msg] };
  }

  for (const tag of tags) {
    logger.info(`Fetching tag: ${tag}`);
    const categorySlug = tagToSlug(tag);

    let gifs;
    try {
      gifs = await fetchWithRetry(token, tag, limit);
      logger.info(`Found ${gifs.length} videos for tag "${tag}"`);
    } catch (err) {
      const msg = `Failed to fetch tag "${tag}": ${err instanceof Error ? err.message : err}`;
      logger.error(msg);
      errors.push(msg);
      await sleep(3000); // back off before next tag even on failure
      continue;
    }

    // Pace requests — Redgifs rate limit is strict
    await sleep(2000);

    for (const gif of gifs) {
      // Composite key: gifId__categorySlug — same gif can exist per-category
      const compositeId = `${gif.id}__${categorySlug}`;

      const exists = await prisma.video.findUnique({
        where: { reddit_id: compositeId },
        select: { id: true },
      });
      if (exists) {
        logger.debug(`Skipping duplicate ${compositeId}`);
        continue;
      }

      try {
        const processed = await processGif(gif, tag);
        const category_id = await resolveOrCreateCategory(tag);

        await prisma.video.create({
          data: {
            url: processed.videoUrl,
            thumbnail: processed.thumbnailUrl,
            title: processed.title,
            category_id,
            duration: processed.duration,
            views: gif.views ?? 0,
            reddit_id: compositeId, // composite so same gif can appear in multiple categories
          },
        });

        videos_fetched++;
        logger.info(`Saved ${gif.id} → category "${categorySlug}"`);
      } catch (err) {
        const msg = `Failed to process ${gif.id}: ${err instanceof Error ? err.message : err}`;
        logger.error(msg);
        errors.push(msg);
      }
    }
  }

  const status: "success" | "partial" | "failed" =
    errors.length === 0 ? "success" : videos_fetched > 0 ? "partial" : "failed";

  await prisma.pipelineLog.create({
    data: { status, videos_fetched, errors },
  });

  logger.info("Pipeline finished", { status, videos_fetched, errors_count: errors.length });
  return { status, videos_fetched, errors };
}

// ─── Scheduler ──────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--run")) {
    logger.info("Manual pipeline trigger");
    runPipeline()
      .then((result) => {
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  } else {
    logger.info(`Pipeline scheduler starting — cron: ${CRON_SCHEDULE}`);

    if (!cron.validate(CRON_SCHEDULE)) {
      logger.error(`Invalid cron expression: ${CRON_SCHEDULE}`);
      process.exit(1);
    }

    cron.schedule(CRON_SCHEDULE, async () => {
      logger.info("Cron triggered pipeline");
      try {
        await runPipeline();
      } catch (err) {
        logger.error("Unhandled pipeline error", {
          err: err instanceof Error ? err.message : err,
        });
      }
    });

    logger.info("Scheduler running — press Ctrl+C to stop");
  }
}
