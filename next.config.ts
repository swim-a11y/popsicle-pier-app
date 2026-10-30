import type { NextConfig } from "next";

// Nothing leaves the device: no Next.js telemetry from build, dev or start.
process.env.NEXT_TELEMETRY_DISABLED = "1";

const nextConfig: NextConfig = {
  cacheComponents: false,
  poweredByHeader: false,
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
