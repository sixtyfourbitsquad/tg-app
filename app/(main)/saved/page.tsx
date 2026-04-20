"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { Bookmark, Play } from "lucide-react";
import type { VideoDTO } from "@/types";

export default function SavedPage() {
  const [videos, setVideos] = useState<VideoDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get<{ saved_videos?: VideoDTO[] }>("/api/profile")
      .then((r) => setVideos(r.data.saved_videos ?? []))
      .catch(() => setVideos([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-dvh bg-bg-primary text-text-primary flex flex-col pb-14">
      <div className="px-4 pt-6 pb-3">
        <h1 className="text-xl font-bold">Saved</h1>
        <p className="text-xs text-white/40 mt-0.5">{videos.length} videos</p>
      </div>

      {loading ? (
        <div className="flex-1 grid grid-cols-3 gap-0.5 px-0">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="bg-white/5 animate-pulse aspect-[9/16]" />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/30 gap-3">
          <Bookmark size={48} strokeWidth={1} />
          <p className="text-sm">No saved videos yet</p>
          <p className="text-xs text-white/20">Tap the bookmark icon on any video</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-0.5">
            {videos.map((video) => (
              <SavedThumb key={video.id} video={video} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SavedThumb({ video }: { video: VideoDTO }) {
  return (
    <Link
      href={`/?v=${encodeURIComponent(video.id)}`}
      prefetch={false}
      className="relative aspect-[9/16] bg-black overflow-hidden group active:opacity-80 transition-opacity"
    >
      {video.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={video.thumbnail}
          alt={video.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        // No thumbnail stored yet — render the first frame of the video itself.
        // `preload="metadata"` and no `autoplay` keeps bandwidth low: the
        // browser fetches just enough to decode a poster frame.
        <video
          src={video.url}
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
      )}

      {/* Subtle overlay so the play icon + title remain legible on busy frames */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      <div className="absolute top-1.5 right-1.5 text-white/90">
        <Play size={14} strokeWidth={2.5} fill="currentColor" />
      </div>

      <div className="absolute bottom-1 left-1 right-1 text-[10px] text-white/90 line-clamp-2 leading-tight">
        {video.title}
      </div>
    </Link>
  );
}
