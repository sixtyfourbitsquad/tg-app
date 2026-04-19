import { PrismaClient } from "@prisma/client";
import { getRedgifsToken, fetchRedgifsVideos, processGif } from "./reddit";
import { logger } from "../lib/logger";

const prisma = new PrismaClient();

interface PipelineResult {
  status: "success" | "partial" | "failed";
  videos_fetched: number;
  errors: string[];
}

async function resolveCategory(tag: string): Promise<string> {
  const slug = tag.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const cat = await prisma.category.findFirst({
    where: { OR: [{ slug }, { name: { contains: tag, mode: "insensitive" } }] },
  });

  if (cat) return cat.id;

  const created = await prisma.category.create({
    data: { name: tag, slug },
  });
  return created.id;
}

export async function runPipeline(): Promise<PipelineResult> {
  const tags = (process.env.REDGIFS_SEARCH_TAGS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const limit = parseInt(process.env.PIPELINE_LIMIT ?? "25", 10);
  const errors: string[] = [];
  let videos_fetched = 0;

  if (tags.length === 0) {
    logger.warn("No search tags configured for pipeline");
    return { status: "failed", videos_fetched: 0, errors: ["No search tags configured"] };
  }

  let token: string;
  try {
    token = await getRedgifsToken();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token fetch failed";
    logger.error("Redgifs auth failed", { err: msg });
    return { status: "failed", videos_fetched: 0, errors: [msg] };
  }

  for (const tag of tags) {
    logger.info(`Fetching tag: ${tag}`);

    let gifs;
    try {
      gifs = await fetchRedgifsVideos(token, tag, limit);
    } catch (err) {
      const msg = `Failed to fetch tag "${tag}": ${err instanceof Error ? err.message : err}`;
      logger.error(msg);
      errors.push(msg);
      continue;
    }

    for (const gif of gifs) {
      const existing = await prisma.video.findUnique({
        where: { reddit_id: gif.id },
      });
      if (existing) continue;

      try {
        const processed = await processGif(gif, tag);
        const category_id = await resolveCategory(processed.tag);

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
        logger.info(`Processed video ${gif.id} for tag "${tag}"`);
      } catch (err) {
        const msg = `Failed to process ${gif.id}: ${err instanceof Error ? err.message : err}`;
        logger.error(msg);
        errors.push(msg);
      }
    }
  }

  const status =
    errors.length === 0
      ? "success"
      : videos_fetched > 0
      ? "partial"
      : "failed";

  await prisma.pipelineLog.create({
    data: { status, videos_fetched, errors },
  });

  logger.info("Pipeline complete", { status, videos_fetched, errors_count: errors.length });

  await prisma.$disconnect();
  return { status, videos_fetched, errors };
}

if (require.main === module) {
  runPipeline()
    .then(console.log)
    .catch(console.error);
}
