import type { NextConfig } from "next";

// Photos are served from R2 through Next's image optimiser, which only fetches
// from hosts listed here. Missing in dev until the bucket is configured.
const r2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL
  ? new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL)
  : null;

const nextConfig: NextConfig = {
  // Next blocks cross-origin requests to /_next/* in dev. Without these, the
  // page loads from a phone on the LAN but every chunk and optimized image is
  // refused — the map never boots and photos never appear.
  allowedDevOrigins: ["192.168.29.61", "172.21.182.47"],
  devIndicators: false,
  images: {
    remotePatterns: r2 ? [{ protocol: "https", hostname: r2.hostname }] : [],
    // Production rejects any `q` not listed here (dev lets it through).
    // 70 is what thumbUrl() asks for on pins; 75 is next/image's default.
    qualities: [70, 75],
  },
};

export default nextConfig;
