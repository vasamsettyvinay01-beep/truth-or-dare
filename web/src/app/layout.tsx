import type { Metadata, Viewport } from "next";
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
  applicationName: "Truth or Dare",
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    title: "Truth or Dare — Play Anywhere",
    description: "Create a room, share the link, play in real time. No accounts.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // maximumScale is intentionally left unset so pinch-zoom keeps working;
  // iOS focus-zoom is prevented with a 16px input font size instead.
  viewportFit: "cover",
  themeColor: "#07070b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${syne.variable} ${mono.variable}`}>
      <body
        className="noise min-h-dvh font-[family-name:var(--font-body-loaded)] antialiased"
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
