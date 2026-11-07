import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The site opens straight into the demo store.
      { source: "/", destination: "/stores/big-demo-diner/menu", permanent: false },
      { source: "/stores/:storeId", destination: "/stores/:storeId/menu", permanent: false },
    ];
  },
  cacheComponents: true,
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
