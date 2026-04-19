import axios from "axios";
import { logger } from "../lib/logger";

const REDGIFS_API = "https://api.redgifs.com/v2";

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
  const username = process.env.REDGIFS_USERNAME;
  const password = process.env.REDGIFS_PASSWORD;

  if (username && password) {
    const { data } = await axios.post<{ token: string }>(`${REDGIFS_API}/auth/native`, {
      username,
      password,
    });
    return data.token;
  }

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

// Store direct Redgifs CDN URLs — no GCS upload needed
export async function processGif(gif: RedgifsGif, tag: string): Promise<ProcessedVideo> {
  const videoUrl = gif.urls.hd ?? gif.urls.sd ?? "";
  const thumbnailUrl = gif.urls.thumbnail ?? gif.urls.poster ?? "";

  logger.info(`Using direct URL for ${gif.id}`);

  return {
    videoUrl,
    thumbnailUrl,
    duration: Math.round(gif.duration ?? 0),
    title: (gif.title ?? tag).slice(0, 200),
    tag,
    redgifs_id: gif.id,
  };
}
