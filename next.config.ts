import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  devIndicators: false,
  serverExternalPackages: ["node:sqlite"],
  images: { unoptimized: true },
  webpack(config) {
    if (process.env.CF_BUILD === "1")
      config.resolve.alias["@/lib/local"] = false;
    return config;
  },
};
export default config;
