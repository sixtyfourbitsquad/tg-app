"use client";

import { motion } from "framer-motion";

interface SkeletonProps {
  className?: string;
}

function SkeletonBlock({ className = "" }: SkeletonProps) {
  return (
    <motion.div
      className={`rounded-lg bg-white/5 overflow-hidden relative ${className}`}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 0.9, 0.5] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-2xl bg-bg-card border border-white/5">
      {/* Thumbnail */}
      <SkeletonBlock className="w-full aspect-video" />

      <div className="flex flex-col gap-1.5 px-1">
        {/* Title */}
        <SkeletonBlock className="h-4 w-3/4" />
        <SkeletonBlock className="h-3 w-1/3" />

        {/* Tags row */}
        <div className="flex gap-2 mt-1">
          <SkeletonBlock className="h-5 w-16 rounded-full" />
          <SkeletonBlock className="h-5 w-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function VideoFeedSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      {Array.from({ length: count }).map((_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  );
}

export { SkeletonBlock as Skeleton };
