"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useVideoFeed } from "@/hooks/useVideoFeed";
import { VideoCard, type VideoCardHandle } from "@/components/VideoCard";
import { VideoFeedSkeleton } from "@/components/ui/Skeleton";

export default function FeedPage() {
  const searchParams = useSearchParams();
  const category = searchParams.get("cat") ?? undefined;

  const [muted, setMuted] = useState(true);
  const { videos, isLoading, isLoadingMore, onVideoVisible } = useVideoFeed(category);
  const cardRefs = useRef<Map<string, VideoCardHandle>>(new Map());

  // Pause all cards when category changes
  useEffect(() => {
    cardRefs.current.forEach((h) => h.pause());
  }, [category]);

  const setCardRef = useCallback(
    (id: string) => (el: VideoCardHandle | null) => {
      if (el) cardRefs.current.set(id, el);
      else cardRefs.current.delete(id);
    },
    []
  );

  return (
    <div className="w-full h-dvh overflow-hidden">
      {isLoading ? (
        <div className="pb-14">
          <VideoFeedSkeleton count={2} />
        </div>
      ) : (
        <div
          className="w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
          style={{ height: "calc(100dvh - 56px)", scrollSnapType: "y mandatory" }}
        >
          <AnimatePresence initial={false}>
            {videos.map((video, index) => (
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
