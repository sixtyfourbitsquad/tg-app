import type { NextConfig } from "next";

// Video files are served from /videos/<filename>. There are three ways this
// can be wired up, in order of preference:
//   1. Nginx `location /videos/` aliased to $VIDEOS_DIR (see nginx.conf).
//   2. A symlink at ./public/videos -> $VIDEOS_DIR (see scripts/setup-videos-symlink.sh).
//   3. The Next.js route handler at app/videos/[...path]/route.ts, which
//      streams files from $VIDEOS_DIR with Range support as a fallback.
// $VIDEOS_DIR defaults to /home/adii/videos.

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle at .next/standalone so the Docker
  // image only needs node_modules Next actually uses (see Dockerfile).
  output: "standalone",
  allowedDevOrigins: ["35.200.162.160"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "preview.redd.it" },
      { protocol: "https", hostname: "i.redd.it" },
      { protocol: "https", hostname: "v.redd.it" },
    ],
  },
  serverExternalPackages: ["@prisma/client", "prisma", "winston", "ioredis"],
  // Expose VIDEOS_DIR to the Node runtime at request time; also documents it.
  env: {
    VIDEOS_DIR: process.env.VIDEOS_DIR ?? "/home/adii/videos",
  },
};

export default nextConfig;
