"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { useInteraction } from "@/hooks/useInteraction";
import { useWatchEvent } from "@/hooks/useWatchEvent";
import { AnimatedCount } from "@/components/ui/AnimatedCount";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Tag } from "@/components/ui/Tag";
import type { VideoDTO } from "@/types";

export interface VideoCardHandle {
  pause: () => void;
}

interface VideoCardProps {
  video: VideoDTO;
  index: number;
  onVisible?: (index: number) => void;
  muted?: boolean;
  onMuteToggle?: () => void;
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="w-7 h-7"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="w-7 h-7"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export const VideoCard = forwardRef<VideoCardHandle, VideoCardProps>(
  function VideoCard({ video, index, onVisible, muted = true, onMuteToggle }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [shareOpen, setShareOpen] = useState(false);

    // 90% visibility threshold for autoplay
    const isVisible = useIntersectionObserver(containerRef, {
      threshold: 0.9,
    });

    const { liked, saved, likeCount, saveCount, toggleLike, toggleSave } =
      useInteraction(video.id, {
        liked: video.liked ?? false,
        saved: video.saved ?? false,
        like_count: video.like_count,
        save_count: video.save_count,
      });

    const { onPlay, onPause, onEnded } = useWatchEvent(video.id);

    // Play / pause based on intersection
    useEffect(() => {
      const el = videoRef.current;
      if (!el) return;

      if (isVisible) {
        el.play().catch(() => {});
        onVisible?.(index);
      } else {
        el.pause();
      }
    }, [isVisible, index, onVisible]);

    // Sync muted state imperatively — React's muted prop is not reactive
    useEffect(() => {
      const el = videoRef.current;
      if (!el) return;
      el.muted = muted;
      // Resume playback after unmuting to unblock audio context
      if (!muted && el.paused === false) {
        el.pause();
        el.play().catch(() => {});
      }
    }, [muted]);

    // Expose pause handle to parent for cleanup
    useImperativeHandle(ref, () => ({
      pause() {
        videoRef.current?.pause();
      },
    }));

    // Free memory on unmount
    useEffect(() => {
      const el = videoRef.current;
      return () => {
        if (el) {
          el.pause();
          el.src = "";
          el.load();
        }
      };
    }, []);

    const handleShare = useCallback(() => {
      if (navigator.share) {
        navigator
          .share({ title: video.title, url: window.location.href })
          .catch(() => {});
      } else {
        setShareOpen(true);
      }
    }, [video.title]);

    const copyLink = useCallback(() => {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
      setShareOpen(false);
    }, []);

    return (
      <div
        ref={containerRef}
        className="relative w-full h-dvh snap-start overflow-hidden bg-black flex-shrink-0"
      >
        {/* Video */}
        <video
          ref={videoRef}
          src={`/api/redgifs/${video.reddit_id}`}
          autoPlay
          muted={muted}
          loop
          playsInline
          // preload="auto" is set below dynamically via data-attr to signal intent
          className="absolute inset-0 w-full h-full object-cover"
          onPlay={onPlay}
          onPause={() => onPause(video.duration)}
          onEnded={() => onEnded(video.duration)}
          poster={video.thumbnail}
        />

        {/* Top gradient for nav readability */}
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
        {/* Bottom gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

        {/* Bottom-left: title + category + views */}
        <div className="absolute bottom-6 left-4 right-20 z-10">
          <Tag label={video.category.name} size="sm" />
          <h2 className="mt-1.5 text-sm font-semibold text-white leading-snug line-clamp-2 drop-shadow">
            {video.title}
          </h2>
          <p className="mt-1 text-xs text-white/60">
            {formatViews(video.views)} views
          </p>
        </div>

        {/* Right sidebar */}
        <div className="absolute right-3 bottom-10 z-10 flex flex-col items-center gap-5">
          {/* Mute / Unmute */}
          {onMuteToggle && (
            <SidebarAction onPress={onMuteToggle} label={muted ? "Unmute" : "Mute"}>
              {muted ? (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </SidebarAction>
          )}

          {/* Like */}
          <SidebarAction
            onPress={toggleLike}
            label={liked ? "Unlike" : "Like"}
            active={liked}
          >
            <HeartIcon filled={liked} />
            <AnimatedCount value={likeCount} />
          </SidebarAction>

          {/* Comment (placeholder — no comment model yet) */}
          <SidebarAction onPress={() => {}} label="Comments">
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-xs">0</span>
          </SidebarAction>

          {/* Share */}
          <SidebarAction onPress={handleShare} label="Share">
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </SidebarAction>

          {/* Save */}
          <SidebarAction
            onPress={toggleSave}
            label={saved ? "Unsave" : "Save"}
            active={saved}
          >
            <BookmarkIcon filled={saved} />
            <AnimatedCount value={saveCount} />
          </SidebarAction>
        </div>

        {/* Share sheet */}
        <BottomSheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          title="Share"
        >
          <div className="flex flex-col gap-2">
            <button
              onClick={copyLink}
              className="flex items-center gap-3 py-3 text-sm text-text-primary hover:text-accent transition-colors"
            >
              <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-lg">
                🔗
              </span>
              Copy link
            </button>
          </div>
        </BottomSheet>
      </div>
    );
  }
);

interface SidebarActionProps {
  onPress: () => void;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}

function SidebarAction({
  onPress,
  label,
  active = false,
  children,
}: SidebarActionProps) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onPress}
      whileTap={{ scale: 0.78 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={`flex flex-col items-center gap-0.5 focus:outline-none
        ${active ? "text-accent" : "text-white"}`}
    >
      {children}
    </motion.button>
  );
}
