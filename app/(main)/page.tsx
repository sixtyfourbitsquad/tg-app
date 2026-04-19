"use client";

import { useRef, useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import axios from "axios";
import { useVideoFeed } from "@/hooks/useVideoFeed";
import { VideoCard, type VideoCardHandle } from "@/components/VideoCard";
import { VideoFeedSkeleton } from "@/components/ui/Skeleton";
import { CategoryStrip } from "@/components/CategoryStrip";
import type { VideoDTO } from "@/types";

export default function FeedPage() {
  return (
    <Suspense fallback={<VideoFeedSkeleton count={2} />}>
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

  const { videos, isLoading, isLoadingMore, onVideoVisible } = useVideoFeed(category);
  const cardRefs = useRef<Map<string, VideoCardHandle>>(new Map());

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
      .then((r) => {
        if (!cancelled) setLeadVideo(r.data);
      })
      .catch(() => {
        if (!cancelled) {
          setLeadVideo(null);
          setLeadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [deepLinkId]);

  const displayVideos =
    leadVideo && !videos.some((v) => v.id === leadVideo.id)
      ? [leadVideo, ...videos]
      : videos;

  useEffect(() => {
    cardRefs.current.forEach((h) => h.pause());
  }, [category, deepLinkId]);

  const setCardRef = useCallback(
    (id: string) => (el: VideoCardHandle | null) => {
      if (el) cardRefs.current.set(id, el);
      else cardRefs.current.delete(id);
    },
    []
  );

  return (
    <div className="w-full h-dvh overflow-hidden relative">
      <CategoryStrip activeSlug={category} />

      {isLoading ? (
        <div className="pb-14">
          <VideoFeedSkeleton count={2} />
        </div>
      ) : (
        <div
          className="w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
          style={{ height: "100dvh", scrollSnapType: "y mandatory" }}
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
                ref={setCardRef(video.id)}
                video={video}
                index={index}
                onVisible={onVideoVisible}
                muted={muted}
                onMuteToggle={() => setMuted((m) => !m)}
              />
            ))}
          </AnimatePresence>

          {isLoadingMore && (
            <div className="h-screen snap-start flex items-center justify-center bg-bg-primary">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
