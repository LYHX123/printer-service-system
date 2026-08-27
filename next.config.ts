import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Dev-only: lets the Next.js dev server (HMR websocket, dev-only asset
  // requests) be reached from the LAN IP used for on-device Capacitor
  // testing. The IP is machine-specific, so it comes from an (untracked)
  // env var — set NEXT_DEV_LAN_ORIGIN in .env.local, e.g.
  //   NEXT_DEV_LAN_ORIGIN=192.168.x.x
  // Empty in every other environment; no effect on `next build`/`next start`.
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
  allowedDevOrigins: process.env.NEXT_DEV_LAN_ORIGIN
    ? [process.env.NEXT_DEV_LAN_ORIGIN]
    : [],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
