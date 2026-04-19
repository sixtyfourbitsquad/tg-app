import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import { uploadFile } from "../lib/gcs";
import { logger } from "../lib/logger";

const REDGIFS_API = "https://api.redgifs.com/v2";
const MAX_RETRIES = 3;

export interface RedgifsGif {
  id: string;
  title?: string;
  urls: {
    hd?: string;
    sd?: string;
    poster?: string;
    thumbnail?: string;
  };
  duration?: number;
  views?: number;
  tags?: string[];
}

export interface ProcessedVideo {
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  title: string;
  tag: string;
  redgifs_id: string;
}

export async function getRedgifsToken(): Promise<string> {
  const { data } = await axios.get<{ token: string }>(`${REDGIFS_API}/auth/temporary`);
  return data.token;
}

export async function fetchRedgifsVideos(
  token: string,
  tag: string,
  count = 25
): Promise<RedgifsGif[]> {
  const { data } = await axios.get<{ gifs: RedgifsGif[] }>(
    `${REDGIFS_API}/gifs/search`,
    {
      params: { search_text: tag, count, order: "trending" },
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return (data.gifs ?? []).filter((g) => g.urls.hd || g.urls.sd);
}

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const delay = 1000 * Math.pow(2, attempt - 1);
      logger.warn(`Retry ${attempt}/${retries} after ${delay}ms`, {
        err: err instanceof Error ? err.message : err,
      });
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw lastError;
}

async function download(url: string, dest: string): Promise<void> {
  const response = await axios.get<Buffer>(url, {
    responseType: "arraybuffer",
    timeout: 120_000,
  });
  fs.writeFileSync(dest, Buffer.from(response.data));
}

export async function processGif(gif: RedgifsGif, tag: string): Promise<ProcessedVideo> {
  const videoSrc = gif.urls.hd ?? gif.urls.sd!;
  const thumbSrc = gif.urls.thumbnail ?? gif.urls.poster;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `nfws-${gif.id}-`));
  const videoPath = path.join(tmpDir, "video.mp4");
  const thumbPath = path.join(tmpDir, "thumb.jpg");

  try {
    logger.info(`Downloading video for ${gif.id}`);
    await withRetry(() => download(videoSrc, videoPath));

    const gcsDest = `videos/${gif.id}.mp4`;
    const gcsThumb = `thumbnails/${gif.id}.jpg`;

    let thumbnailUrl = "";
    if (thumbSrc) {
      await withRetry(() => download(thumbSrc, thumbPath));
      thumbnailUrl = await uploadFile(thumbPath, gcsThumb, "image/jpeg");
    }

    logger.info(`Uploading to GCS: ${gcsDest}`);
    const videoUrl = await uploadFile(videoPath, gcsDest, "video/mp4");

    return {
      videoUrl,
      thumbnailUrl,
      duration: Math.round(gif.duration ?? 0),
      title: (gif.title ?? tag).slice(0, 200),
      tag,
      redgifs_id: gif.id,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
