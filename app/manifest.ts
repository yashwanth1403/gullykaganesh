import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

/** Add-to-home-screen during the festival; the map is the app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Ganesh pandals of Hyderabad`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF9F6",
    theme_color: "#D6402C",
    lang: "en-IN",
    categories: ["travel", "navigation", "lifestyle"],
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
