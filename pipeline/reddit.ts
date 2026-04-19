import axios, { AxiosError } from "axios";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";
import { uploadFile } from "../lib/gcs";
import { logger } from "../lib/logger";

const USER_AGENT =
  process.env.REDDIT_USER_AGENT ?? "nfws-bot/1.0 by u/your-username";
const REDDIT_OAUTH = "https://oauth.reddit.com";
const MIN_SCORE = 100;
const MAX_RETRIES = 3;

export interface RedditPost {
  id: string;
  title: string;
  score: number;
  subreddit: string;
  is_video: boolean;
  domain: string;
  media: {
    reddit_video?: {
      fallback_url: string;
      dash_url: string;
      duration: number;
      height: number;
      width: number;
    };
  } | null;
  preview?: {
    images?: Array<{ source: { url: string } }>;
  } | null;
}

export interface ProcessedVideo {
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  title: string;
  subreddit: string;
  reddit_id: string;
}

/** Fetch OAuth token from Reddit */
export async function getRedditToken(): Promise<string> {
  const { data } = await axios.post<{ access_token: string }>(
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
  return data.access_token;
}

/** Fetch hot video posts from a subreddit */
export async function fetchSubredditVideos(
  token: string,
  subreddit: string,
  limit = 25
): Promise<RedditPost[]> {
  const { data } = await axios.get<{
    data: { children: Array<{ data: RedditPost }> };
  }>(`${REDDIT_OAUTH}/r/${subreddit}/hot.json?limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
    },
  });

  return data.data.children
    .map((c) => c.data)
    .filter(
      (p) =>
        p.is_video &&
        p.domain === "v.redd.it" &&
        p.score >= MIN_SCORE &&
        p.media?.reddit_video != null
    );
}

/** Retry a function with exponential backoff */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isAxiosErr = err instanceof AxiosError;
      // Don't retry client errors (4xx)
      if (isAxiosErr && err.response && err.response.status < 500) throw err;

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      logger.warn(`Retry ${attempt}/${retries} after ${delay}ms`, {
        err: err instanceof Error ? err.message : err,
      });
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw lastError;
}

/** Download a URL to a local tmp file */
async function download(url: string, dest: string): Promise<void> {
  const response = await axios.get<Buffer>(url, {
    responseType: "arraybuffer",
    headers: { "User-Agent": USER_AGENT },
    timeout: 60_000,
  });
  fs.writeFileSync(dest, Buffer.from(response.data));
}

/**
 * Build the audio URL from the DASH video URL.
 * Reddit serves audio as a separate DASH stream.
 * e.g. https://v.redd.it/xxx/DASH_720.mp4 → https://v.redd.it/xxx/DASH_audio.mp4
 */
function audioUrlFrom(videoUrl: string): string {
  return videoUrl.replace(/DASH_\d+\.mp4/, "DASH_audio.mp4");
}

/** Merge video + audio with ffmpeg, output to dest path */
function mergeAV(
  videoPath: string,
  audioPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        "-c:v copy",     // copy video codec — no re-encode
        "-c:a aac",      // encode audio to AAC
        "-b:a 128k",
        "-movflags +faststart",
        "-shortest",
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .run();
  });
}

/** Generate a JPEG thumbnail from the first frame */
function extractThumbnail(videoPath: string, thumbPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ["3%"],
        filename: path.basename(thumbPath),
        folder: path.dirname(thumbPath),
        size: "720x?", // maintain aspect ratio
      })
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err));
  });
}

/**
 * Full processing pipeline for a single Reddit post:
 * download video + audio → merge → thumbnail → upload to GCS.
 */
export async function processPost(post: RedditPost): Promise<ProcessedVideo> {
  const rv = post.media!.reddit_video!;
  const videoSrc = rv.fallback_url.replace("?source=fallback", "");
  const audioSrc = audioUrlFrom(videoSrc);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `nfws-${post.id}-`));
  const videoRaw = path.join(tmpDir, "video.mp4");
  const audioRaw = path.join(tmpDir, "audio.mp4");
  const merged = path.join(tmpDir, "merged.mp4");
  const thumb = path.join(tmpDir, "thumb.jpg");

  try {
    logger.info(`Downloading video for ${post.id}`);
    await withRetry(() => download(videoSrc, videoRaw));

    logger.info(`Downloading audio for ${post.id}`);
    const hasAudio = await withRetry(() => download(audioSrc, audioRaw))
      .then(() => true)
      .catch(() => {
        logger.warn(`No audio track for ${post.id} — using video only`);
        return false;
      });

    if (hasAudio) {
      logger.info(`Merging A/V for ${post.id}`);
      await mergeAV(videoRaw, audioRaw, merged);
    } else {
      fs.copyFileSync(videoRaw, merged);
    }

    logger.info(`Generating thumbnail for ${post.id}`);
    await extractThumbnail(merged, thumb);

    const gcsDest = `videos/${post.id}.mp4`;
    const gcsThumb = `thumbnails/${post.id}.jpg`;

    logger.info(`Uploading to GCS: ${gcsDest}`);
    const [videoUrl, thumbnailUrl] = await Promise.all([
      uploadFile(merged, gcsDest, "video/mp4"),
      uploadFile(thumb, gcsThumb, "image/jpeg"),
    ]);

    return {
      videoUrl,
      thumbnailUrl,
      duration: rv.duration,
      title: post.title.slice(0, 200),
      subreddit: post.subreddit,
      reddit_id: post.id,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
