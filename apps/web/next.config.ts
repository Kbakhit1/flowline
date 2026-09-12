import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: deploys as plain files on Cloudflare Workers static assets.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
