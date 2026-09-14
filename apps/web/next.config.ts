import type { NextConfig } from "next";

// GitHub Pages serves the demo under /flowline; Cloudflare serves it at the root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Static export: deploys as plain files (Cloudflare Workers static assets, GitHub Pages).
  output: "export",
  basePath,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
