"use client";

import { useCallback, useEffect, useState } from "react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import type { CatalogMeal } from "@/lib/meal-catalog-types";

const EXAMPLE_JSON = `[
  {
    "id": "meal_011",
    "title": "Jogurt z Granola",
    "description": "Szybkie śniadanie.",
    "mealType": "breakfast",
    "calories": 350,
    "protein": 24,
    "carbs": 40,
    "fat": 10,
    "imagePrompt": "greek yogurt bowl with granola and fresh berries, professional food photography"
  }
]`;

export function AdminCatalogClient() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [jsonText, setJsonText] = useState(EXAMPLE_JSON);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [dbMeals, setDbMeals] = useState<CatalogMeal[]>([]);
  const [mergedCount, setMergedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/catalog");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        dbMeals: CatalogMeal[];
        mergedCount: number;
      };
      setDbMeals(data.dbMeals ?? []);
      setMergedCount(data.mergedCount ?? 0);
    } catch {
      setError("Nie udało się wczytać katalogu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setJsonText(text);
  }

  async function importJson() {
    setBusy(true);
    setError(null);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        throw new Error("Niepoprawny JSON — sprawdź składnię.");
      }
      const body =
        Array.isArray(parsed)
          ? { mode, meals: parsed }
          : { ...(parsed as object), mode };

      await ensureCsrfCookie();
      const res = await fetch("/api/admin/catalog", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getXsrfHeaders(),
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; upserted?: number; totalMerged?: number }
        | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "Import nie powiódł się.");
      }
      notifySaved(
        `Zapisano ${data?.upserted ?? 0} przepisów (łącznie w aplikacji: ${data?.totalMerged ?? "—"}).`,
      );
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import nie powiódł się.";
      setError(msg);
      notifyError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function clearDb() {
    if (
      !confirm(
        "Usunąć wszystkie przepisy wgrane przez panel (seed w kodzie zostanie)?",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await ensureCsrfCookie();
      const res = await fetch("/api/admin/catalog", {
        method: "DELETE",
        credentials: "include",
        headers: { ...getXsrfHeaders() },
      });
      if (!res.ok) throw new Error();
      notifySaved("Wyczyszczono przepisy z bazy.");
      await load();
    } catch {
      notifyError("Nie udało się wyczyścić katalogu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel neon-glow p-5 sm:p-6">
        <h1 className="font-heading text-xl font-semibold text-white">
          Katalog przepisów
        </h1>
        <p className="mt-1 text-sm text-white/55">
          Wgraj przepisy w JSON — trafiają do bazy i są od razu widoczne w Dietcie
          (bez deployu kodu). Pole{" "}
          <span className="font-mono text-white/70">imagePrompt</span> idzie do
          Pollinations AI (grafiki nie są zapisywane w bazie).
        </p>
        <p className="mt-2 text-xs text-white/45">
          W bazie panelu: {loading ? "…" : dbMeals.length} · Po scaleniu z seedem:{" "}
          {loading ? "…" : mergedCount}
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="glass-panel neon-glow space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-white/70">
            Plik JSON
            <input
              type="file"
              accept="application/json,.json"
              className="mt-1 block w-full text-xs text-white/60 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70">
            Tryb
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "merge" | "replace")}
              className="rounded-md border border-white/15 bg-black/40 px-2 py-1.5 text-white"
            >
              <option value="merge">Scal (upsert po id)</option>
              <option value="replace">Zastąp całą bazę panelu</option>
            </select>
          </label>
        </div>

        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          rows={16}
          spellCheck={false}
          className="w-full rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs text-white/90 outline-none focus:border-[var(--neon)]/50"
        />

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={() => void importJson()}>
            {busy ? "Zapisywanie…" : "Wgraj przepisy"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || dbMeals.length === 0}
            onClick={() => void clearDb()}
          >
            Wyczyść bazę panelu
          </Button>
        </div>
      </div>

      <div className="glass-panel neon-glow overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 text-sm text-white/60">
          Przepisy w bazie (panel)
        </div>
        <div className="max-h-[min(50vh,420px)] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-zinc-950/95 text-[11px] uppercase tracking-wide text-white/45">
              <tr>
                <th className="px-4 py-2">Id</th>
                <th className="px-4 py-2">Tytuł</th>
                <th className="px-4 py-2">Slot</th>
                <th className="px-4 py-2">Kcal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-white/85">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-white/45">
                    Ładowanie…
                  </td>
                </tr>
              ) : dbMeals.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-white/45">
                    Brak wpisów z panelu — używany jest seed z kodu.
                  </td>
                </tr>
              ) : (
                dbMeals.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2 font-mono text-xs">{m.id}</td>
                    <td className="px-4 py-2">{m.title}</td>
                    <td className="px-4 py-2">{m.slot}</td>
                    <td className="px-4 py-2 tabular-nums">
                      {Math.round(m.approximateMacros.calories)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
