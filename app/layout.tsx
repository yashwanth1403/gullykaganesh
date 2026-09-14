import type { Metadata, Viewport } from "next";
import { Rozha_One, Karla, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/* Self-hosted at build time — no request to fonts.googleapis.com,
   no layout shift on the first paint of the map. */
const rozha = Rozha_One({
  variable: "--font-rozha",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  display: "swap",
});

const jet = JetBrains_Mono({
  variable: "--font-jet",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://gullykaganesh.live"),
  title: "GullyKaGanesh — every Ganesh in every gully of Hyderabad",
  description:
    "Find the Ganesh idols near you. A map of Hyderabad's mandapams, added by the people who walk past them.",
  openGraph: {
    title: "GullyKaGanesh",
    description:
      "Every Ganesh in every gully of Hyderabad. Find the ones near you.",
    url: "https://gullykaganesh.live",
    siteName: "GullyKaGanesh",
    locale: "en_IN",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF9F6",
  width: "device-width",
  initialScale: 1,
  // The map is full-bleed; let it run under the notch.
  viewportFit: "cover",
  // Pinch-zoom belongs to the map, not the page.
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${rozha.variable} ${karla.variable} ${jet.variable} h-full`}
    >
      {/* No overflow lock here: the map page pins itself to the viewport with
          its own h-dvh/overflow-hidden; every other route scrolls normally. */}
      <body className="min-h-full bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
