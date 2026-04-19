import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import {
  getRedditToken,
  fetchSubredditVideos,
  processPost,
} from "./reddit";
import { logger } from "../lib/logger";

const prisma = new PrismaClient();
const CRON_SCHEDULE = process.env.PIPELINE_CRON ?? "0 */6 * * *";

async function resolveOrCreateCategory(subreddit: string): Promise<string> {
  const slug = subreddit.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const cat = await prisma.category.upsert({
    where: { slug },
    update: {},
    create: { name: subreddit, slug },
  });
  return cat.id;
}

export async function runPipeline(): Promise<{
  status: "success" | "partial" | "failed";
  videos_fetched: number;
  errors: string[];
}> {
  const subreddits = (process.env.PIPELINE_SUBREDDITS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const limit = parseInt(process.env.PIPELINE_LIMIT ?? "25", 10);
  const errors: string[] = [];
  let videos_fetched = 0;

  if (subreddits.length === 0) {
    logger.error("PIPELINE_SUBREDDITS not configured");
    return { status: "failed", videos_fetched: 0, errors: ["No subreddits configured"] };
  }

  logger.info("Pipeline started", { subreddits, limit });

  let token: string;
  try {
    token = await getRedditToken();
    logger.info("Reddit token obtained");
  } catch (err) {
    const msg = `Reddit auth failed: ${err instanceof Error ? err.message : err}`;
    logger.error(msg);
    await prisma.pipelineLog.create({
      data: { status: "failed", videos_fetched: 0, errors: [msg] },
    });
    return { status: "failed", videos_fetched: 0, errors: [msg] };
  }

  for (const sub of subreddits) {
    logger.info(`Fetching r/${sub}`);

    let posts;
    try {
      posts = await fetchSubredditVideos(token, sub, limit);
      logger.info(`Found ${posts.length} eligible videos in r/${sub}`);
    } catch (err) {
      const msg = `Failed to fetch r/${sub}: ${err instanceof Error ? err.message : err}`;
      logger.error(msg);
      errors.push(msg);
      continue;
    }

    for (const post of posts) {
      // Skip already processed
      const exists = await prisma.video.findUnique({
        where: { reddit_id: post.id },
        select: { id: true },
      });
      if (exists) {
        logger.debug(`Skipping duplicate ${post.id}`);
        continue;
      }

      try {
        const processed = await processPost(post);
        const category_id = await resolveOrCreateCategory(processed.subreddit);

        await prisma.video.create({
          data: {
            url: processed.videoUrl,
            thumbnail: processed.thumbnailUrl,
            title: processed.title,
            category_id,
            duration: processed.duration,
            reddit_id: processed.reddit_id,
          },
        });

        videos_fetched++;
        logger.info(`Saved video ${post.id} from r/${sub}`);
      } catch (err) {
        const msg = `Failed to process ${post.id}: ${err instanceof Error ? err.message : err}`;
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
    // Manual one-shot run: tsx pipeline/scheduler.ts --run
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
    // Daemon mode: schedule on cron
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
