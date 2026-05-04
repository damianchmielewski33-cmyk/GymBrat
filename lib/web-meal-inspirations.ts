import "server-only";

import type { MacroGaps } from "@/lib/meal-suggestions-gaps";
import { isWebSearchKnowledgeConfigured } from "@/lib/web-search-fallback";

type CseItem = { title?: string; link?: string; snippet?: string };
type CseResponse = { items?: CseItem[]; error?: { message?: string } };

const CUSTOM_SEARCH_URL = "https://www.googleapis.com/customsearch/v1";

function searchApiKey(): string | undefined {
  return (
    process.env.GOOGLE_CUSTOM_SEARCH_API_KEY?.trim() ||
    process.env.GOOGLE_SEARCH_API_KEY?.trim() ||
    undefined
  );
}

function searchEngineId(): string | undefined {
  return (
    process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID?.trim() ||
    process.env.GOOGLE_SEARCH_ENGINE_ID?.trim() ||
    undefined
  );
}

export type WebMealInspiration = {
  title: string;
  snippet: string;
  url: string;
};

function buildMealQueryPl(gaps: MacroGaps): string {
  const wantsProtein =
    typeof gaps.proteinRemaining === "number" && gaps.proteinRemaining >= 30;
  const wantsCarbs =
    typeof gaps.carbsRemaining === "number" && gaps.carbsRemaining >= 60;
  const wantsLowCal =
    typeof gaps.caloriesRemaining === "number" && gaps.caloriesRemaining <= 500;

  const tags: string[] = [];
  if (wantsProtein) tags.push("wysokobiałkowy");
  if (wantsLowCal) tags.push("niskokaloryczny");
  if (wantsCarbs) tags.push("węglowodanowy");

  // Keep query short and recipe-oriented.
  const base = tags.length ? tags.join(" ") : "zdrowy";
  return `przepis ${base} szybki posiłek`;
}

export async function getWebMealInspirations(
  gaps: MacroGaps,
): Promise<WebMealInspiration[] | null> {
  if (!isWebSearchKnowledgeConfigured()) return null;
  const key = searchApiKey();
  const cx = searchEngineId();
  if (!key || !cx) return null;

  const q = buildMealQueryPl(gaps);

  const url = new URL(CUSTOM_SEARCH_URL);
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", q.slice(0, 200));
  url.searchParams.set("num", "6");
  url.searchParams.set("lr", "lang_pl");

  const res = await fetch(url.toString(), {
    method: "GET",
    // "Regularnie aktualizowane": odśwież co 6h na poziomie cache Next.
    next: { revalidate: 6 * 60 * 60 },
  });
  const rawText = await res.text();

  let data: CseResponse;
  try {
    data = JSON.parse(rawText) as CseResponse;
  } catch {
    return null;
  }
  if (!res.ok) return null;
  if (data.error?.message) return null;

  const items = (data.items ?? [])
    .map((it) => ({
      title: String(it.title ?? "").replace(/\s+/g, " ").trim(),
      snippet: String(it.snippet ?? "").replace(/\s+/g, " ").trim(),
      url: String(it.link ?? "").trim(),
    }))
    .filter((x) => x.title.length > 3 && x.url.startsWith("http"));

  return items.length ? items : null;
}

