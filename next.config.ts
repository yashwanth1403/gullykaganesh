import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next blocks cross-origin requests to /_next/* in dev. Without these, the
  // page loads from a phone on the LAN but every chunk is refused — the map
  // never boots.
  allowedDevOrigins: ["192.168.29.61", "172.21.182.47"],
  devIndicators: false,
  images: {
    // Photos come straight from R2. Vercel's optimiser is metered (5K
    // transformations on Hobby, exhausted on 2026-09-17, mid-festival) so
    // sizes are cut at upload time instead: a 1600px web copy plus a 320px
    // thumb, see lib/resize-image.ts and lib/r2.ts.
    unoptimized: true,
  },
};

export default nextConfig;
