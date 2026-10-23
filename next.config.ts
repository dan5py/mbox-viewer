import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// The Content-Security-Policy is set in src/proxy.ts because it depends on
// runtime env vars (the Umami script URL).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  // Every image is rendered with `unoptimized`, so turn off the
  // /_next/image endpoint entirely and drop its attack surface.
  images: {
    unoptimized: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
