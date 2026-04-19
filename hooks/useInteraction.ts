"use client";

import { useState, useCallback } from "react";
import axios from "axios";
import type { LikeResponse, SaveResponse } from "@/types";

interface InitialState {
  liked: boolean;
  saved: boolean;
  like_count: number;
  save_count: number;
}

export function useInteraction(videoId: string, initial: InitialState) {
  const [liked, setLiked] = useState(initial.liked);
  const [saved, setSaved] = useState(initial.saved);
  const [likeCount, setLikeCount] = useState(initial.like_count);
  const [saveCount, setSaveCount] = useState(initial.save_count);
  const [loading, setLoading] = useState(false);

  const toggleLike = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    // Optimistic update
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));

    try {
      const { data } = await axios.post<LikeResponse>(
        `/api/videos/${videoId}/like`
      );
      setLiked(data.liked);
      setLikeCount(data.count);
    } catch {
      // Rollback
      setLiked(wasLiked);
      setLikeCount((c) => c + (wasLiked ? 1 : -1));
    } finally {
      setLoading(false);
    }
  }, [videoId, liked, loading]);

  const toggleSave = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    const wasSaved = saved;
    setSaved(!wasSaved);
    setSaveCount((c) => c + (wasSaved ? -1 : 1));

    try {
      const { data } = await axios.post<SaveResponse>(
        `/api/videos/${videoId}/save`
      );
      setSaved(data.saved);
      setSaveCount(data.count);
    } catch {
      setSaved(wasSaved);
      setSaveCount((c) => c + (wasSaved ? 1 : -1));
    } finally {
      setLoading(false);
    }
  }, [videoId, saved, loading]);

  return {
    liked,
    saved,
    likeCount,
    saveCount,
    loading,
    toggleLike,
    toggleSave,
  };
}
