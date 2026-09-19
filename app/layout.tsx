import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { MetalBackdrop } from "@/components/layout/metal-backdrop";
import { ActiveWorkoutGlobalBar } from "@/components/active-workout/active-workout-global-bar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "optional",
});

const displayFont = localFont({
  variable: "--font-display",
  display: "swap",
  src: [
    { path: "../public/fonts/teko-latin-ext.woff2", weight: "400 700", style: "normal" },
    { path: "../public/fonts/teko-latin.woff2", weight: "400 700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: {
    default: "GymBrat — centrum treningowe",
    template: "%s · GymBrat",
  },
  description:
    "Nowoczesny dziennik treningowy i żywieniowy: plany, historia, raporty, wartości odżywcze i integracja z Fitatu.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GymBrat",
  },
};

export const viewport: Viewport = {
  themeColor: "#00C9B1",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} h-full`}
      style={
        {
          "--awp-bg-stadium": 'url("/stadium-bg.svg")',
          "--awp-bg-pitch-lines": 'url("/pitch-lines.svg")',
        } as CSSProperties
      }
    >
      <body className="marketplace-bg min-h-full font-sans antialiased">
        <MetalBackdrop />
        <AppProviders>
          {children}
          <ActiveWorkoutGlobalBar />
        </AppProviders>
      </body>
    </html>
  );
}
