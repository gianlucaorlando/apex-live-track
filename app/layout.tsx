import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "F1 Live Track",
  description: "Dashboard non ufficiale con dati OpenF1 quasi real-time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
