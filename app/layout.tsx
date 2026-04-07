import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { MetalBackdrop } from "@/components/layout/metal-backdrop";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "GymBrat — Premium training OS",
    template: "%s · GymBrat",
  },
  description:
    "Nowoczesne śledzenie treningów: Turso, edge caching, makra z Fitatu i architektura gotowa na AI.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GymBrat",
  },
};

export const viewport: Viewport = {
  themeColor: "#07080d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full`}
    >
      <body className="min-h-full font-sans antialiased">
        <MetalBackdrop />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
