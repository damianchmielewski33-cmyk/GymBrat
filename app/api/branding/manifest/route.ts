import { NextResponse } from "next/server";
import { getBrandingPublicMap } from "@/lib/app-branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dynamiczny manifest PWA — ikony z panelu admina, gdy ustawione. */
export async function GET() {
  const assets = await getBrandingPublicMap();
  const icons: Array<{
    src: string;
    sizes: string;
    type: string;
    purpose: string;
  }> = [];

  const pwa = assets.icon_pwa ?? assets.icon_web ?? assets.logo_app;
  if (pwa) {
    icons.push({
      src: pwa.url,
      sizes: "any",
      type: pwa.mimeType,
      purpose: "any",
    });
    icons.push({
      src: pwa.url,
      sizes: "512x512",
      type: pwa.mimeType,
      purpose: "maskable",
    });
  } else {
    icons.push({
      src: "/next.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any",
    });
  }

  const body = {
    name: "GymBrat",
    short_name: "GymBrat",
    description: "Premium fitness OS — training, cardio, macros, AI-ready.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#07080d",
    theme_color: "#07080d",
    icons,
  };

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
