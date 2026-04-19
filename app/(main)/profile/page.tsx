"use client";

import { useEffect, useState, useCallback } from "react";
import { Crown, Heart, Bookmark, User, Copy, Check } from "lucide-react";
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
  const [connectCode, setConnectCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then(setProfile)
      .finally(() => setLoading(false));
  }, []);

  const generateCode = useCallback(async () => {
    const res = await fetch("/api/auth/connect", { method: "POST" });
    const { code } = await res.json();
    setConnectCode(code);
  }, []);

  const copyCode = useCallback(() => {
    if (!connectCode) return;
    navigator.clipboard.writeText(`/connect ${connectCode}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [connectCode]);

  return (
    <div className="h-dvh bg-bg-primary text-text-primary flex flex-col" style={{ paddingTop: 56 }}>
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

          {/* Telegram connect */}
          {!profile?.telegram_id && (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Connect Telegram</p>
                  <p className="text-xs text-white/30 mt-0.5">Sync your data across devices</p>
                </div>
                {!connectCode && (
                  <button
                    onClick={generateCode}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#229ED9] text-white text-xs font-semibold"
                  >
                    Get Code
                  </button>
                )}
              </div>

              {connectCode && (
                <div className="space-y-2">
                  <p className="text-xs text-white/50">Send this command to the bot:</p>
                  <div className="flex items-center gap-2 bg-black/40 rounded-xl px-3 py-2.5 border border-white/10">
                    <code className="flex-1 text-sm text-accent font-mono">/connect {connectCode}</code>
                    <button onClick={copyCode} className="text-white/50 hover:text-white transition-colors">
                      {copied ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-white/30">Code expires in 10 minutes</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
