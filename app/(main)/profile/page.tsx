"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { VideoDTO } from "@/types";

interface ProfileData {
  username: string;
  is_premium: boolean;
  saved_videos: VideoDTO[];
  like_count: number;
  save_count: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setProfile(d))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-dvh bg-bg-primary text-text-primary">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Profile</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : profile ? (
        <div className="px-4 py-6 space-y-6">
          {/* Avatar + info */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-3xl font-bold text-accent shrink-0">
              {profile.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xl font-semibold truncate">{profile.username}</p>
                {profile.is_premium && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/20 text-accent border border-accent/30">
                    Premium
                  </span>
                )}
              </div>
              {!profile.is_premium && (
                <button className="mt-1 text-xs text-accent hover:underline">
                  Upgrade to Premium
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Liked" value={profile.like_count} />
            <StatCard label="Saved" value={profile.save_count} />
          </div>

          {/* Login section */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Account</p>
              <p className="text-xs text-text-muted mt-0.5">Login with Telegram to sync your data</p>
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#229ED9] text-white text-sm font-medium hover:bg-[#1a8bbf] transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z" />
              </svg>
              Connect
            </button>
          </div>

          {/* Saved videos */}
          <div>
            <h2 className="text-base font-semibold mb-3">Saved Videos</h2>
            {profile.saved_videos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-text-muted gap-2">
                <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                <p className="text-sm">No saved videos yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {profile.saved_videos.map((video) => (
                  <SavedVideoThumb key={video.id} video={video} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-text-muted mt-1">{label}</p>
    </div>
  );
}

function SavedVideoThumb({ video }: { video: VideoDTO }) {
  return (
    <div className="relative aspect-[9/16] bg-black rounded overflow-hidden">
      {video.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-white/5 flex items-center justify-center">
          <svg className="w-6 h-6 text-white/20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
      <div className="absolute bottom-1 left-1 right-1">
        <p className="text-[10px] text-white line-clamp-1 drop-shadow">{video.title}</p>
      </div>
    </div>
  );
}
