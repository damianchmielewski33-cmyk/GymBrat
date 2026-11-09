import type { FoodProduct } from "@/lib/food-products-types";

/**
 * Publiczne ostrzeżenia konsumenckie GIS (wycofania produktów ze sklepów).
 * Źródło: konfigurowalne `GIS_ALERTS_FEED_URL` (RSS/Atom albo strona HTML gov.pl/web/gis).
 * Błąd źródła nigdy nie psuje aplikacji — zwracamy pustą listę.
 */

export const GIS_DEFAULT_FEED_URL = "https://www.gov.pl/web/gis/ostrzezenia";
const GIS_ORIGIN = "https://www.gov.pl";

export type GisAlert = {
  id: string;
  title: string;
  url: string;
  /** ISO lub null, gdy źródło nie podaje daty. */
  publishedAt: string | null;
};

export type GisAlertsResult = { ok: boolean; alerts: GisAlert[] };

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== "https:") return null;
    if (u.hostname !== "www.gov.pl" && u.hostname !== "gov.pl") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function toIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = Date.parse(raw.trim());
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function pickTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m?.[1] ? decodeEntities(m[1]) : null;
}

function parseRss(body: string, base: string): GisAlert[] {
  const out: GisAlert[] = [];
  const blocks = body.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  for (const b of blocks) {
    const title = pickTag(b, "title");
    const linkTag = pickTag(b, "link");
    const linkAttr = b.match(/<link[^>]*href="([^"]+)"/i)?.[1];
    const url = safeUrl(linkTag || linkAttr || "", base);
    if (!title || !url) continue;
    out.push({
      id: url,
      title,
      url,
      publishedAt: toIso(pickTag(b, "pubDate") ?? pickTag(b, "updated") ?? pickTag(b, "published")),
    });
  }
  return out;
}

function parseHtml(body: string, base: string): GisAlert[] {
  const out: GisAlert[] = [];
  const seen = new Set<string>();
  const re = /<a\s[^>]*href="([^"]*\/web\/gis\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const url = safeUrl(m[1]!, base);
    const title = decodeEntities(m[2] ?? "");
    if (!url || title.length < 12 || seen.has(url)) continue;
    // Tylko wpisy o ostrzeżeniach / wycofaniach (pomija menu i stopkę serwisu).
    if (!/ostrze|wycof|alert|komunikat|niebezpiecz/i.test(`${title} ${url}`)) continue;
    seen.add(url);
    out.push({ id: url, title, url, publishedAt: null });
  }
  return out;
}

/** Parsuje RSS/Atom albo HTML listy ostrzeżeń. */
export function parseGisFeed(body: string, baseUrl = GIS_DEFAULT_FEED_URL): GisAlert[] {
  const rss = /<(rss|feed|rdf:RDF)[\s>]/i.test(body) ? parseRss(body, baseUrl) : [];
  const alerts = rss.length > 0 ? rss : parseHtml(body, baseUrl);
  return alerts.slice(0, 60);
}

export function gisFeedUrl(): string {
  const raw = process.env.GIS_ALERTS_FEED_URL?.trim();
  return raw && safeUrl(raw, GIS_ORIGIN) ? raw : GIS_DEFAULT_FEED_URL;
}

export async function fetchGisAlerts(): Promise<GisAlertsResult> {
  const feed = gisFeedUrl();
  try {
    const res = await fetch(feed, {
      headers: {
        "User-Agent": "GymBrat/1.0 (https://github.com/damianchmielewski33-cmyk/GymBrat)",
        Accept: "application/rss+xml, application/atom+xml, text/html;q=0.8",
      },
      next: { revalidate: 3 * 60 * 60 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, alerts: [] };
    const body = (await res.text()).slice(0, 2_000_000);
    return { ok: true, alerts: parseGisFeed(body, feed) };
  } catch {
    return { ok: false, alerts: [] };
  }
}

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERIC = new Set([
  "produkt", "napoj", "drink", "mleko", "ser", "chleb", "maslo", "jogurt",
  "wedlina", "sok", "woda", "sos", "salatka", "zupa", "mieso",
]);

/**
 * Dopasowanie ostrożne (fałszywy alarm o wycofaniu szkodzi): EAN w tytule,
 * albo marka + znaczące słowo z nazwy, albo ≥3 znaczące słowa nazwy.
 */
export function matchGisAlerts(alerts: GisAlert[], product: FoodProduct): GisAlert[] {
  const brand = product.brand ? norm(product.brand) : "";
  const nameTokens = Array.from(
    new Set(
      norm(product.name)
        .split(" ")
        .filter((t) => t.length >= 4 && t !== brand),
    ),
  );
  const specific = nameTokens.filter((t) => !GENERIC.has(t));
  return alerts.filter((a) => {
    const title = norm(a.title);
    const words = new Set(title.split(" "));
    if (product.barcode && title.includes(product.barcode)) return true;
    const hits = nameTokens.filter((t) => words.has(t)).length;
    if (brand.length >= 3 && words.has(brand) && hits >= 1) return true;
    return specific.filter((t) => words.has(t)).length >= 3;
  });
}
