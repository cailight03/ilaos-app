import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    // Reuse visited pages in the browser so switching modules is instant.
    // Server actions, API routes and fresh page loads still re-check access.
    staleTimes: { dynamic: 120, static: 300 },
    // Receipt uploads (5 MB max) travel in a server action.
    serverActions: { bodySizeLimit: "6mb" },
  },
  cacheComponents: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
