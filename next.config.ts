import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep generated article metadata in the document head instead of streaming it.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
