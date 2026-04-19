import { PrismaClient } from "@prisma/client";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";
import { uploadFile, uploadBuffer } from "../lib/gcs";
import { logger } from "../lib/logger";

const prisma = new PrismaClient();

const REDDIT_BASE = "https://oauth.reddit.com";
const USER_AGENT = process.env.REDDIT_USER_AGENT ?? "nfws-bot/1.0";

interface RedditPost {
  id: string;
  title: string;
  url: string;
  is_video: boolean;
  media?: { reddit_video?: { fallback_url: string; duration: number } } | null;
  preview?: { images?: Array<{ source: { url: string } }> } | null;
  link_flair_text?: string | null;
  subreddit: string;
}

interface PipelineResult {
  status: "success" | "partial" | "failed";
  videos_fetched: number;
  errors: string[];
}

async function getRedditToken(): Promise<string> {
  const { data } = await axios.post(
    "https://www.reddit.com/api/v1/access_token",
    "grant_type=client_credentials",
    {
      auth: {
        username: process.env.REDDIT_CLIENT_ID ?? "",
        password: process.env.REDDIT_SECRET ?? "",
      },
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );
  return data.access_token as string;
}

async function fetchSubredditPosts(
  token: string,
  subreddit: string,
  limit = 25
): Promise<RedditPost[]> {
  const { data } = await axios.get(
    `${REDDIT_BASE}/r/${subreddit}/hot.json?limit=${limit}`,
    {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT },
    }
  );

  return (data.data.children as Array<{ data: RedditPost }>)
    .map((c) => c.data)
    .filter((p) => p.is_video && p.media?.reddit_video);
}

function extractThumbnail(post: RedditPost): string {
  const rawUrl = post.preview?.images?.[0]?.source?.url ?? "";
  // Reddit HTML-encodes preview URLs
  return rawUrl.replace(/&amp;/g, "&");
}

async function getVideoMetadata(url: string): Promise<{ duration: number }> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(url, (err, meta) => {
      if (err) return resolve({ duration: 0 });
      resolve({ duration: Math.round(meta.format.duration ?? 0) });
    });
  });
}

async function downloadAndUpload(
  post: RedditPost
): Promise<{ videoUrl: string; thumbnailUrl: string; duration: number }> {
  const videoSrc = post.media!.reddit_video!.fallback_url.replace(
    "?source=fallback",
    ""
  );
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nfws-"));
  const rawPath = path.join(tmpDir, `${post.id}_raw.mp4`);
  const outPath = path.join(tmpDir, `${post.id}.mp4`);
  const thumbPath = path.join(tmpDir, `${post.id}_thumb.jpg`);

  try {
    // Download video
    const response = await axios.get<Buffer>(videoSrc, {
      responseType: "arraybuffer",
      headers: { "User-Agent": USER_AGENT },
    });
    fs.writeFileSync(rawPath, Buffer.from(response.data));

    // Re-encode to ensure compatibility + generate thumbnail
    await new Promise<void>((resolve, reject) => {
      ffmpeg(rawPath)
        .outputOptions(["-c:v libx264", "-preset fast", "-crf 23", "-movflags +faststart"])
        .output(outPath)
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .run();
    });

    await new Promise<void>((resolve, reject) => {
      ffmpeg(outPath)
        .screenshots({
          timestamps: ["5%"],
          filename: path.basename(thumbPath),
          folder: path.dirname(thumbPath),
          size: "640x360",
        })
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err));
    });

    const dest = `videos/${post.id}`;
    const thumbDest = `thumbnails/${post.id}.jpg`;

    const [videoUrl, thumbnailUrl] = await Promise.all([
      uploadFile(outPath, dest, "video/mp4"),
      uploadFile(thumbPath, thumbDest, "image/jpeg"),
    ]);

    const { duration } = await getVideoMetadata(outPath);

    return { videoUrl, thumbnailUrl, duration };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function resolveCategory(subreddit: string): Promise<string> {
  const slug = subreddit.toLowerCase();
  const cat = await prisma.category.findFirst({
    where: { OR: [{ slug }, { name: { contains: slug, mode: "insensitive" } }] },
  });

  if (cat) return cat.id;

  // Create new category on the fly
  const created = await prisma.category.create({
    data: { name: subreddit, slug },
  });
  return created.id;
}

export async function runPipeline(): Promise<PipelineResult> {
  const subreddits = (process.env.PIPELINE_SUBREDDITS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const limit = parseInt(process.env.PIPELINE_LIMIT ?? "25", 10);
  const errors: string[] = [];
  let videos_fetched = 0;

  if (subreddits.length === 0) {
    logger.warn("No subreddits configured for pipeline");
    return { status: "failed", videos_fetched: 0, errors: ["No subreddits configured"] };
  }

  let token: string;
  try {
    token = await getRedditToken();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token fetch failed";
    logger.error("Reddit auth failed", { err: msg });
    return { status: "failed", videos_fetched: 0, errors: [msg] };
  }

  for (const sub of subreddits) {
    logger.info(`Fetching r/${sub}`);

    let posts: RedditPost[];
    try {
      posts = await fetchSubredditPosts(token, sub, limit);
    } catch (err) {
      const msg = `Failed to fetch r/${sub}: ${err instanceof Error ? err.message : err}`;
      logger.error(msg);
      errors.push(msg);
      continue;
    }

    for (const post of posts) {
      // Skip already-processed
      const existing = await prisma.video.findUnique({
        where: { reddit_id: post.id },
      });
      if (existing) continue;

      try {
        const { videoUrl, thumbnailUrl, duration } = await downloadAndUpload(post);
        const category_id = await resolveCategory(post.subreddit);

        await prisma.video.create({
          data: {
            url: videoUrl,
            thumbnail: thumbnailUrl,
            title: post.title.slice(0, 200),
            category_id,
            duration,
            reddit_id: post.id,
          },
        });

        videos_fetched++;
        logger.info(`Processed video ${post.id} from r/${sub}`);
      } catch (err) {
        const msg = `Failed to process ${post.id}: ${err instanceof Error ? err.message : err}`;
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

// Allow direct execution: ts-node pipeline/runner.ts
if (require.main === module) {
  runPipeline()
    .then(console.log)
    .catch(console.error);
}
