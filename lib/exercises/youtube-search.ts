import "server-only";

export type YoutubeSearchCandidate = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string | null;
};

/**
 * YouTube Data API v3 `search.list` — tylko panel admina.
 * Bez YOUTUBE_API_KEY zwraca pustą listę + komunikat (nie 500).
 */
export async function searchYoutubeTechniqueCandidates(
  query: string,
): Promise<
  | { ok: true; candidates: YoutubeSearchCandidate[] }
  | { ok: false; error: string; missingConfig?: boolean }
> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) {
    return {
      ok: false,
      missingConfig: true,
      error:
        "Brak YOUTUBE_API_KEY na hostingu. Możesz wkleić link YouTube ręcznie.",
    };
  }
  const q = query.trim();
  if (q.length < 2) {
    return { ok: false, error: "Za krótkie zapytanie." };
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "5");
  url.searchParams.set("q", `${q} technique`);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) {
    return {
      ok: false,
      error: "YouTube API nie odpowiedziało. Spróbuj później lub wklej link.",
    };
  }
  const data = (await res.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: { default?: { url?: string } };
      };
    }>;
  };
  const candidates: YoutubeSearchCandidate[] = [];
  for (const item of data.items ?? []) {
    const videoId = item.id?.videoId;
    if (!videoId) continue;
    candidates.push({
      videoId,
      title: item.snippet?.title ?? videoId,
      channelTitle: item.snippet?.channelTitle ?? "",
      thumbnailUrl: item.snippet?.thumbnails?.default?.url ?? null,
    });
  }
  return { ok: true, candidates };
}
