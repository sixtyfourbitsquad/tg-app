"use client";

import { useEffect, useState } from "react";
import { Crown, Heart, Bookmark, User } from "lucide-react";
import { useUser } from "@/context/UserContext";

interface ProfileData {
  username: string;
  is_premium: boolean;
  like_count: number;
  save_count: number;
  telegram_id?: string;
}

export default function ProfilePage() {
  const { user: tgUser, isPremium: tgPremium } = useUser();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then(setProfile)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-dvh bg-bg-primary text-text-primary flex flex-col" style={{ paddingBottom: 56 }}>
      <div className="px-4 pt-6 pb-3">
        <h1 className="text-xl font-bold">Profile</h1>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : profile ? (
        <div className="flex-1 overflow-y-auto px-4 space-y-5 pb-4">
          {/* Avatar */}
          <div className="flex items-center gap-4 pt-2">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
              {tgUser?.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tgUser.photo_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={36} className="text-white/40" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold">
                  {tgUser?.first_name ?? (profile.username !== "Anonymous" && profile.username !== "Guest" ? `@${profile.username}` : profile.username)}
                </p>
                {(profile.is_premium || tgPremium) && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    <Crown size={10} /> Premium
                  </span>
                )}
              </div>
              {(tgUser?.username || profile.username !== "Anonymous") && (
                <p className="text-xs text-white/30 mt-0.5">@{tgUser?.username ?? profile.username}</p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center gap-3">
              <Heart size={20} className="text-accent" />
              <div>
                <p className="text-xl font-bold">{profile.like_count}</p>
                <p className="text-xs text-white/40">Liked</p>
              </div>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center gap-3">
              <Bookmark size={20} className="text-accent" />
              <div>
                <p className="text-xl font-bold">{profile.save_count}</p>
                <p className="text-xs text-white/40">Saved</p>
              </div>
            </div>
          </div>

          {/* Subscription */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Subscription</p>
                <p className="text-xs text-white/40 mt-0.5">
                  {(profile.is_premium || tgPremium) ? "You have full access" : "Upgrade for unlimited access"}
                </p>
              </div>
              {!(profile.is_premium || tgPremium) && (
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-xs font-bold">
                  <Crown size={12} /> Upgrade
                </button>
              )}
            </div>
          </div>

          {/* Telegram login */}
          {!tgUser && (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Connect Telegram</p>
                <p className="text-xs text-white/30 mt-0.5">Sync your data across devices</p>
              </div>
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#229ED9] text-white text-xs font-semibold">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z" />
                </svg>
                Connect
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
