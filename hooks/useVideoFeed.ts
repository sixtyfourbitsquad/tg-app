"use client";

import { useMemo } from "react";
import useSWRInfinite from "swr/infinite";
import axios from "axios";
import type { FeedResponse, VideoDTO } from "@/types";

export type FeedSort = "random" | "trending";

const LIMIT = 10;
const PREFETCH_THRESHOLD = 2; // fetch next page when this many videos remain

const fetcher = (url: string) =>
  axios.get<FeedResponse>(url).then((r) => r.data);

function generateSeed(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useVideoFeed(sort: FeedSort = "random") {
  // One seed per hook instance so each visit to the feed gets a different
  // order while pagination within the session stays consistent.
  const seed = useMemo(() => (sort === "random" ? generateSeed() : null), [sort]);

  const getKey = (
    pageIndex: number,
    previousData: FeedResponse | null,
  ): string | null => {
    if (previousData && !previousData.hasMore) return null;

    const params = new URLSearchParams({ limit: String(LIMIT), sort });
    if (seed) params.set("seed", seed);
    if (previousData?.nextCursor) params.set("cursor", previousData.nextCursor);

    return `/api/videos?${params.toString()}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite(getKey, fetcher, {
      revalidateOnFocus: false,
      revalidateFirstPage: false,
    });

  const videos: VideoDTO[] = data?.flatMap((p) => p.videos) ?? [];
  const hasMore = data ? (data[data.length - 1]?.hasMore ?? false) : true;
  const isLoadingMore = isValidating && size > (data?.length ?? 0);

  /**
   * Call this when the user scrolls to within PREFETCH_THRESHOLD videos of the
   * end. The caller passes the current index in the video array.
   */
  function onVideoVisible(index: number) {
    if (isLoadingMore || !hasMore) return;
    if (videos.length - index <= PREFETCH_THRESHOLD) {
      setSize((s) => s + 1);
    }
  }

  return {
    videos,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    mutate,
    onVideoVisible,
  };
}
