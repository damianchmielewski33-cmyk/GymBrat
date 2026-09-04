/** Siostrzana aplikacja Akademia Wielkich Piłkarzy — przejścia między serwisami. */

export const DEFAULT_AWP_URL = "https://akademia-wielkich-pilkarzy.vercel.app";
export const AWP_SITE_NAME = "Akademia Wielkich Piłkarzy";
export const AWP_SITE_TAGLINE = "Terminarz, mecze i rankingi — siostrzana aplikacja";

export function getAwpUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_AWP_URL?.trim();
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      /* ignore */
    }
  }
  return DEFAULT_AWP_URL;
}

export function getAwpCrossLink(path = "/"): string {
  const base = getAwpUrl().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${p === "/" ? "/" : p}`);
  url.searchParams.set("from", "gymbrat");
  return url.toString();
}
