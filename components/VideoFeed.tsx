"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useVideoFeed, type FeedSort } from "@/hooks/useVideoFeed";
import { VideoCard, type VideoCardHandle } from "@/components/VideoCard";
import { FeedItemSkeleton } from "@/components/ui/Skeleton";
import type { VideoDTO } from "@/types";

interface VideoFeedProps {
  sort: FeedSort;
  /** Optionally pin a single video at the top (used for deep links). */
  leadVideo?: VideoDTO | null;
  /** Show a "video not found" banner when a deep link fails to resolve. */
  leadError?: boolean;
  /** Change to force all currently-mounted cards to pause (e.g. on navigation). */
  refreshKey?: string | null;
  emptyState?: { title: string; subtitle?: string };
}

export function VideoFeed({
  sort,
  leadVideo,
  leadError,
  refreshKey,
  emptyState,
}: VideoFeedProps) {
  const { videos, isLoading, isLoadingMore, onVideoVisible, error, mutate } =
    useVideoFeed(sort);
  const cardRefs = useRef<Map<number, VideoCardHandle>>(new Map());
  const [muted, setMuted] = useState(true);

  const displayVideos =
    leadVideo && !videos.some((v) => v.id === leadVideo.id)
      ? [leadVideo, ...videos]
      : videos;

  useEffect(() => {
    cardRefs.current.forEach((h) => h.pause());
  }, [refreshKey]);

  const setCardRef = useCallback(
    (index: number) => (el: VideoCardHandle | null) => {
      if (el) cardRefs.current.set(index, el);
      else cardRefs.current.delete(index);
    },
    [],
  );

  const handleBecomeActive = useCallback(
    (activeIdx: number) => {
      cardRefs.current.forEach((handle, i) => {
        if (i !== activeIdx) {
          handle.pause();
          handle.setPreload("none" as const);
        }
      });
      const active = cardRefs.current.get(activeIdx);
      active?.setPreload("auto" as const);
      active?.play();
      cardRefs.current.get(activeIdx + 1)?.loadBuffer();
      onVideoVisible(activeIdx);
    },
    [onVideoVisible],
  );

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black">
        <FeedItemSkeleton count={2} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center bg-black">
        <p className="text-sm text-white/80">Could not load the feed.</p>
        <p className="text-xs text-white/40">
          Check API, database, and Redis on the server.
        </p>
        <button
          type="button"
          onClick={() => void mutate()}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-black"
        >
          Retry
        </button>
      </div>
    );
  }

  if (displayVideos.length === 0) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-black">
        <p className="text-sm text-white/80">
          {emptyState?.title ?? "No videos yet."}
        </p>
        {emptyState?.subtitle && (
          <p className="text-xs text-white/40">{emptyState.subtitle}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black"
      style={{ scrollSnapType: "y mandatory" }}
    >
      {leadError && (
        <div className="absolute top-4 left-3 right-3 z-30 rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs text-red-200">
          Video not found — showing your feed.
        </div>
      )}

      <AnimatePresence initial={false}>
        {displayVideos.map((video, index) => (
          <VideoCard
            key={video.id}
            ref={setCardRef(index)}
            video={video}
            index={index}
            onBecomeActive={handleBecomeActive}
            muted={muted}
            onToggleMute={toggleMute}
          />
        ))}
      </AnimatePresence>

      {isLoadingMore && <FeedItemSkeleton count={3} />}
    </div>
  );
}
