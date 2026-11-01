import type { Metadata, Viewport } from "next";
import Script from "next/script";
import {
  Bebas_Neue,
  Geist,
  Geist_Mono,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { MetalBackdrop } from "@/components/layout/metal-backdrop";
import { ActiveWorkoutGlobalBar } from "@/components/active-workout/active-workout-global-bar";
import { IframeSessionBreakout } from "@/components/embed/iframe-session-breakout";

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

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  // Bez tablicy weight — Turbopack na Vercel pada na
  // „next/font/google queries have exactly one entry”.
  // Space Grotesk jest fontem zmiennym (300–700).
  display: "swap",
});

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

const siteOrigin = (
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.NEXTAUTH_URL?.trim() ||
  "http://localhost:3000"
).replace(/\/$/, "");

const siteDescription =
  "Nowoczesny dziennik treningowy i żywieniowy: plany, historia, raporty, skan posiłków i wartości odżywcze.";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: {
    default: "GymBrat — centrum treningowe",
    template: "%s · GymBrat",
  },
  description: siteDescription,
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    siteName: "GymBrat",
    title: "GymBrat — centrum treningowe",
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "GymBrat — centrum treningowe",
    description: siteDescription,
  },
  manifest: "/api/branding/manifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GymBrat",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#07080d",
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
      className={`dark ${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${bebasNeue.variable} h-full`}
    >
      <body className="min-h-full font-sans antialiased">
        {process.env.NODE_ENV === "production" ? (
          <Script src="/client-hardening.js" strategy="beforeInteractive" />
        ) : null}
        <MetalBackdrop />
        <AppProviders>
          <IframeSessionBreakout />
          {children}
          <ActiveWorkoutGlobalBar />
        </AppProviders>
      </body>
    </html>
  );
}
