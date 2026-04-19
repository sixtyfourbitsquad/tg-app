"use client";

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import type { VideoDTO } from "@/types";

export default function SavedPage() {
  const [videos, setVideos] = useState<VideoDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setVideos(d.saved_videos ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-dvh bg-bg-primary text-text-primary flex flex-col" style={{ paddingTop: 56 }}>
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
    <div className="relative aspect-[9/16] bg-black overflow-hidden">
      {video.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-white/5" />
      )}
    </div>
  );
}
