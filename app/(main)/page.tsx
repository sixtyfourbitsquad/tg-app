"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useVideoFeed } from "@/hooks/useVideoFeed";
import { useCategories } from "@/hooks/useCategories";
import { VideoCard, type VideoCardHandle } from "@/components/VideoCard";
import { VideoFeedSkeleton } from "@/components/ui/Skeleton";

export default function FeedPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string | undefined>();
  const [muted, setMuted] = useState(true);
  const { categories } = useCategories();
  const { videos, isLoading, isLoadingMore, onVideoVisible } =
    useVideoFeed(activeCategory);

  // Track card refs so we can pause the previously active card on category change
  const cardRefs = useRef<Map<string, VideoCardHandle>>(new Map());

  const handleCategoryChange = useCallback((slug: string | undefined) => {
    // Pause all playing videos when switching category
    cardRefs.current.forEach((handle) => handle.pause());
    setActiveCategory(slug);
  }, []);

  const setCardRef = useCallback(
    (id: string) => (el: VideoCardHandle | null) => {
      if (el) cardRefs.current.set(id, el);
      else cardRefs.current.delete(id);
    },
    []
  );

  return (
    <div className="relative w-full h-dvh overflow-hidden">
      {/* ── Floating category tabs ─────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 z-30 pt-safe flex items-start">
        <div className="flex-1 min-w-0">
          <CategoryTabs
            categories={[{ id: "all", name: "For You", slug: "" }, ...categories]}
            active={activeCategory ?? ""}
            onChange={(slug) => handleCategoryChange(slug || undefined)}
          />
        </div>
        <button
          onClick={() => router.push("/profile")}
          className="mt-2 mr-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white shrink-0"
          aria-label="Profile"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>
      </div>

      {/* ── Scroll snap feed ───────────────────────────────────── */}
      {isLoading ? (
        <div className="pt-14">
          <VideoFeedSkeleton count={2} />
        </div>
      ) : (
        <div
          className="w-full h-dvh overflow-y-scroll snap-y snap-mandatory no-scrollbar"
          style={{ scrollSnapType: "y mandatory" }}
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

          {/* Loading more indicator */}
          {isLoadingMore && (
            <div className="h-dvh snap-start flex items-center justify-center bg-bg-primary">
              <div className="flex flex-col items-center gap-3 text-text-muted">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full"
                />
                <span className="text-xs">Loading more…</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Category Tabs ─────────────────────────────────────────────────────────

interface Tab {
  id: string;
  name: string;
  slug: string;
}

interface CategoryTabsProps {
  categories: Tab[];
  active: string;
  onChange: (slug: string) => void;
}

function CategoryTabs({ categories, active, onChange }: CategoryTabsProps) {
  return (
    <div className="flex overflow-x-auto no-scrollbar px-4 py-2 gap-1 bg-gradient-to-b from-black/60 to-transparent">
      {categories.map((cat) => {
        const isActive = active === cat.slug;
        return (
          <button
            key={cat.id}
            onClick={() => onChange(cat.slug)}
            className={`relative flex-shrink-0 px-3 py-1 text-sm font-medium transition-colors duration-150
              focus:outline-none
              ${isActive ? "text-white" : "text-white/50 hover:text-white/80"}`}
          >
            {cat.name}
            {isActive && (
              <motion.div
                layoutId="category-underline"
                className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-accent"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
