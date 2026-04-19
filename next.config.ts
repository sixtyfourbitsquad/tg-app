import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "preview.redd.it" },
      { protocol: "https", hostname: "i.redd.it" },
      { protocol: "https", hostname: "v.redd.it" },
    ],
  },
  serverExternalPackages: ["@prisma/client", "prisma", "winston", "ioredis"],
};

export default nextConfig;
