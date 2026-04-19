import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
