"use client";

import { useRef, useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import axios from "axios";
import { useVideoFeed } from "@/hooks/useVideoFeed";
import { VideoCard, type VideoCardHandle } from "@/components/VideoCard";
import { FeedItemSkeleton } from "@/components/ui/Skeleton";
import { CategoryStrip } from "@/components/CategoryStrip";
import type { VideoDTO } from "@/types";

export default function FeedPage() {
  return (
    <Suspense fallback={null}>
      <Feed />
    </Suspense>
  );
}

function Feed() {
  const searchParams = useSearchParams();
  const category = searchParams.get("cat") ?? undefined;
  const deepLinkId = searchParams.get("v");

  const [muted, setMuted] = useState(true);
  const [leadVideo, setLeadVideo] = useState<VideoDTO | null>(null);
  const [leadError, setLeadError] = useState(false);

  const { videos, isLoading, isLoadingMore, onVideoVisible, error, mutate } = useVideoFeed(category);
  const cardRefs = useRef<Map<number, VideoCardHandle>>(new Map());

  useEffect(() => {
    if (!deepLinkId) {
      setLeadVideo(null);
      setLeadError(false);
      return;
    }
    let cancelled = false;
    setLeadError(false);
    axios
      .get<VideoDTO>(`/api/videos/${deepLinkId}`)
      .then((r) => { if (!cancelled) setLeadVideo(r.data); })
      .catch(() => { if (!cancelled) { setLeadVideo(null); setLeadError(true); } });
    return () => { cancelled = true; };
  }, [deepLinkId]);

  const displayVideos =
    leadVideo && !videos.some((v) => v.id === leadVideo.id)
      ? [leadVideo, ...videos]
      : videos;

  useEffect(() => {
    cardRefs.current.forEach((h) => h.pause());
  }, [category, deepLinkId]);

  const setCardRef = useCallback(
    (index: number) => (el: VideoCardHandle | null) => {
      if (el) cardRefs.current.set(index, el);
      else cardRefs.current.delete(index);
    },
    []
  );

  const handleBecomeActive = useCallback((activeIdx: number) => {
    // Pause all others and reset their preload
    cardRefs.current.forEach((handle, i) => {
      if (i !== activeIdx) {
        handle.pause();
        handle.setPreload("none" as const);
      }
    });
    // Play active with preload=auto
    const active = cardRefs.current.get(activeIdx);
    active?.setPreload("auto" as const);
    active?.play();
    // Buffer next 1 only
    cardRefs.current.get(activeIdx + 1)?.loadBuffer();
    // Trigger pagination when within last 2 videos
    onVideoVisible(activeIdx);
  }, [onVideoVisible]);

  if (isLoading) {
    return (
      <>
        <CategoryStrip activeSlug={category} />
        <div className="fixed inset-0 overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black">
          <FeedItemSkeleton count={2} />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center bg-black">
        <p className="text-sm text-white/80">Could not load the feed.</p>
        <p className="text-xs text-white/40">Check API, database, and Redis on the server.</p>
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
        <p className="text-sm text-white/80">No videos in the database yet.</p>
        <p className="text-xs text-white/40">Run the pipeline on the server: npm run pipeline:run</p>
      </div>
    );
  }

  return (
    <>
      <CategoryStrip activeSlug={category} />

      <div
        className="fixed inset-0 overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {leadError && deepLinkId && (
          <div className="absolute top-14 left-3 right-3 z-30 rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs text-red-200">
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
              onMuteToggle={() => setMuted((m) => !m)}
            />
          ))}
        </AnimatePresence>

        {isLoadingMore && <FeedItemSkeleton count={3} />}
      </div>
    </>
  );
}
