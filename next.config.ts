import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    agentUpgrade: "security",
  },
  // The chat route reads /content at runtime, so it must ship with the function.
  outputFileTracingIncludes: {
    "/api/chat": ["./content/**/*.md"],
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
