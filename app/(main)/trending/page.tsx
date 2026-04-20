"use client";

import { VideoFeed } from "@/components/VideoFeed";

export default function TrendingPage() {
  return (
    <VideoFeed
      sort="trending"
      emptyState={{
        title: "Nothing trending yet.",
        subtitle: "Videos will show up here once they start getting views.",
      }}
    />
  );
}
