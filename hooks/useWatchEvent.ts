"use client";

import { useRef, useCallback } from "react";
import axios from "axios";
import type { WatchPayload } from "@/types";

export function useWatchEvent(videoId: string) {
  const startRef = useRef<number | null>(null);
  const reportedRef = useRef(false);

  const onPlay = useCallback(() => {
    startRef.current = Date.now();
    reportedRef.current = false;
  }, []);

  const report = useCallback(
    async (durationSeconds: number) => {
      if (reportedRef.current || startRef.current === null) return;
      reportedRef.current = true;

      const elapsed = Math.round((Date.now() - startRef.current) / 1000);
      const watch_time = Math.min(elapsed, durationSeconds);
      const completed = watch_time >= durationSeconds * 0.85;

      try {
        await axios.post<void>("/api/interactions/watch", {
          video_id: videoId,
          watch_time,
          completed,
        } satisfies WatchPayload);
      } catch {
        // Non-critical — swallow silently
      }
    },
    [videoId]
  );

  const onPause = useCallback(
    (durationSeconds: number) => report(durationSeconds),
    [report]
  );

  const onEnded = useCallback(
    (durationSeconds: number) => report(durationSeconds),
    [report]
  );

  return { onPlay, onPause, onEnded };
}
