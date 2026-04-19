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

async function resolveOrCreateCategory(tag: string): Promise<string> {
  const slug = tag.toLowerCase().replace(/[^a-z0-9-]/g, "-");
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

    let gifs;
    try {
      gifs = await fetchRedgifsVideos(token, tag, limit);
      logger.info(`Found ${gifs.length} videos for tag "${tag}"`);
    } catch (err) {
      const msg = `Failed to fetch tag "${tag}": ${err instanceof Error ? err.message : err}`;
      logger.error(msg);
      errors.push(msg);
      continue;
    }

    for (const gif of gifs) {
      const exists = await prisma.video.findUnique({
        where: { reddit_id: gif.id },
        select: { id: true },
      });
      if (exists) {
        logger.debug(`Skipping duplicate ${gif.id}`);
        continue;
      }

      try {
        const processed = await processGif(gif, tag);
        const category_id = await resolveOrCreateCategory(processed.tag);

        await prisma.video.create({
          data: {
            url: processed.videoUrl,
            thumbnail: processed.thumbnailUrl,
            title: processed.title,
            category_id,
            duration: processed.duration,
            reddit_id: processed.redgifs_id,
          },
        });

        videos_fetched++;
        logger.info(`Saved video ${gif.id} for tag "${tag}"`);
      } catch (err) {
        const msg = `Failed to process ${gif.id}: ${err instanceof Error ? err.message : err}`;
        logger.error(msg);
        errors.push(msg);
      }
    }
  }

  const status: "success" | "partial" | "failed" =
    errors.length === 0
      ? "success"
      : videos_fetched > 0
      ? "partial"
      : "failed";

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
