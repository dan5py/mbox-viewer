import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  // Every image is rendered with `unoptimized`, so turn off the
  // /_next/image endpoint entirely and drop its attack surface.
  images: {
    unoptimized: true,
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
