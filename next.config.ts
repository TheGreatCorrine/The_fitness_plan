import type { NextConfig } from "next";
const config: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  images: { unoptimized: true },
};
export default config;
