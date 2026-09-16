import type { Metadata, Viewport } from "next";
import { Rozha_One, Karla, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import {
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
  jsonLd,
} from "@/lib/site";

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
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    // Child pages set a plain title; the brand rides along for the SERP.
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  category: "travel",
  alternates: { canonical: "/" },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  // Phone numbers in pandal descriptions shouldn't turn into tel: links on iOS.
  formatDetection: { telephone: false },
};

/**
 * What the site *is*, for the knowledge panel and the sitelinks searchbox
 * heuristics: one WebSite, published by one Organization, both named
 * GullyKaGanesh. Spelled-apart aliases catch "gully ka ganesh" queries.
 */
const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: SITE_NAME,
      alternateName: ["Gully Ka Ganesh", "Gully Ka Ganesh Hyderabad"],
      url: SITE_URL,
      logo: `${SITE_URL}/icon.png`,
      areaServed: { "@type": "City", name: "Hyderabad" },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      alternateName: "Gully Ka Ganesh",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      inLanguage: "en-IN",
      publisher: { "@id": `${SITE_URL}/#org` },
    },
  ],
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(siteJsonLd) }} />
        {children}
      </body>
    </html>
  );
}
