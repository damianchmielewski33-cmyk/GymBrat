import "server-only";

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

/** Fallback tylko gdy ustawisz klucz API + identyfikator silnika (cx) z Programmable Search Engine. */
export function isWebSearchKnowledgeConfigured(): boolean {
  return Boolean(searchApiKey() && searchEngineId());
}

export type CoachSearchMessage = { role: string; content: string };

/** Zapytanie do wyszukiwarki z ostatnich wiadomości użytkownika (bez system promptu). */
export function buildCoachSearchQuery(messages: CoachSearchMessage[]): string {
  const users = messages.filter((m) => m.role === "user").slice(-2);
  const raw = users
    .map((m) => String(m.content ?? "").trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const cut = raw.slice(0, 220);
  return cut.length > 10 ? cut : "trening siłowy technika regeneracja żywienie sportowiec";
}

type CseItem = { title?: string; link?: string; snippet?: string };

type CseResponse = { items?: CseItem[]; error?: { message?: string } };

/**
 * Zwraca sformatowany tekst PL z wynikami Google Custom Search albo `null` (brak konfiguracji / błąd / brak wyników).
 */
export async function fetchWebKnowledgeForCoachQuery(query: string): Promise<string | null> {
  const key = searchApiKey();
  const cx = searchEngineId();
  if (!key || !cx) return null;

  const url = new URL(CUSTOM_SEARCH_URL);
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query.slice(0, 200));
  url.searchParams.set("num", "5");
  url.searchParams.set("lr", "lang_pl");

  try {
    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    const rawText = await res.text();
    let data: CseResponse;
    try {
      data = JSON.parse(rawText) as CseResponse;
    } catch {
      return null;
    }
    if (!res.ok) {
      return null;
    }
    if (data.error?.message) {
      return null;
    }
    const items = data.items ?? [];
    if (items.length === 0) return null;

    const blocks = items.map((it, i) => {
      const title = (it.title ?? "Źródło").replace(/\s+/g, " ").trim();
      const sn = (it.snippet ?? "").replace(/\s+/g, " ").trim();
      const link = (it.link ?? "").trim();
      const linkLine = link ? `\n   ${link}` : "";
      return `${i + 1}. ${title}\n   ${sn}${linkLine}`;
    });

    return [
      "Połączenie z modelem AI nie powiodło się. Poniżej skróty z publicznie dostępnych stron — każdą informację warto zweryfikować u autora artykułu:",
      "",
      ...blocks,
    ].join("\n");
  } catch {
    return null;
  }
}
