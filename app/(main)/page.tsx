"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import { VideoFeed } from "@/components/VideoFeed";
import type { VideoDTO } from "@/types";

export default function FeedPage() {
  return (
    <Suspense fallback={null}>
      <Feed />
    </Suspense>
  );
}

function Feed() {
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get("v");

  const [leadVideo, setLeadVideo] = useState<VideoDTO | null>(null);
  const [leadError, setLeadError] = useState(false);

  useEffect(() => {
    if (!deepLinkId) {
      setLeadVideo(null);
      setLeadError(false);
      return;
    }
    let cancelled = false;
    setLeadError(false);
    axios
      .get<VideoDTO>(`/api/videos/${deepLinkId}`)
      .then((r) => {
        if (!cancelled) setLeadVideo(r.data);
      })
      .catch(() => {
        if (!cancelled) {
          setLeadVideo(null);
          setLeadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [deepLinkId]);

  return (
    <VideoFeed
      sort="random"
      leadVideo={leadVideo}
      leadError={leadError && !!deepLinkId}
      refreshKey={deepLinkId}
      emptyState={{
        title: "No videos in the database yet.",
        subtitle: "Add videos to the database to populate the feed.",
      }}
    />
  );
}
