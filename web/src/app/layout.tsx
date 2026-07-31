import type { Metadata } from "next";
import { Outfit, Syne, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-body-loaded",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display-loaded",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-loaded",
});

export const metadata: Metadata = {
  title: "Truth or Dare — Play Anywhere",
  description:
    "Premium real-time multiplayer Truth or Dare. Create a room, invite friends, no accounts required.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${syne.variable} ${mono.variable}`}>
      <body
        className="noise min-h-screen font-[family-name:var(--font-body-loaded)] antialiased"
        style={
          {
            "--font-body": "var(--font-body-loaded)",
            "--font-display": "var(--font-display-loaded)",
            "--font-mono": "var(--font-mono-loaded)",
          } as React.CSSProperties
        }
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
