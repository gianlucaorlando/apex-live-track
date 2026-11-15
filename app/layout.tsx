import type { Metadata } from "next";
import { Inter, Titillium_Web } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const titillium = Titillium_Web({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  variable: "--font-titillium",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const title = "Apex Live Track";
const description =
  "Dashboard full-stack non ufficiale per seguire sessioni Formula-style con tracciato live, classifica, giri, gomme, meteo e cronaca in tempo reale.";
const thumbnail = "/assets/apex-live-track-linkedin-thumb.png";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    images: [
      {
        url: thumbnail,
        width: 1200,
        height: 630,
        alt: "Apex Live Track dashboard con tracciato live e telemetria motorsport",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [thumbnail],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${inter.variable} ${titillium.variable}`}>
      <body>{children}</body>
    </html>
  );
}
