"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dumbbell } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { MUSCLE_CATEGORIES, categoryLabel } from "@/lib/workout-exercise-catalog";
import { normalizeYoutubeUrl } from "@/lib/youtube-url";
import { cn } from "@/lib/utils";

type Row = {
  catalogId: string;
  name: string;
  categoryId: string;
  youtubeUrl: string | null;
};

export function AdminExercisesClient() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/exercises/technique", {
        credentials: "include",
      });
      if (!res.ok) {
        setError("Nie udało się wczytać listy ćwiczeń.");
        return;
      }
      const data = (await res.json()) as { rows?: Row[] };
      const list = Array.isArray(data.rows) ? data.rows : [];
      setRows(list);
      const next: Record<string, string> = {};
      for (const r of list) next[r.catalogId] = r.youtubeUrl ?? "";
      setDrafts(next);
    } catch {
      setError("Błąd sieci przy wczytywaniu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (categoryId !== "all" && r.categoryId !== categoryId) return false;
      if (onlyMissing && r.youtubeUrl) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.catalogId.toLowerCase().includes(q) ||
        categoryLabel(r.categoryId).toLowerCase().includes(q)
      );
    });
  }, [rows, query, categoryId, onlyMissing]);

  const withUrl = rows.filter((r) => r.youtubeUrl).length;

  async function saveRow(catalogId: string) {
    const youtubeUrl = drafts[catalogId] ?? "";
    if (youtubeUrl.trim() && !normalizeYoutubeUrl(youtubeUrl)) {
      notifyError("Podaj poprawny link YouTube (youtube.com / youtu.be).");
      return;
    }
    setBusyId(catalogId);
    try {
      await ensureCsrfCookie();
      const res = await fetch("/api/admin/exercises/technique", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getXsrfHeaders(),
        },
        body: JSON.stringify({ catalogId, youtubeUrl }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        youtubeUrl?: string | null;
      };
      if (!res.ok) {
        notifyError(data.error ?? "Zapis nie powiódł się.");
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.catalogId === catalogId
            ? { ...r, youtubeUrl: data.youtubeUrl ?? null }
            : r,
        ),
      );
      setDrafts((prev) => ({
        ...prev,
        [catalogId]: data.youtubeUrl ?? "",
      }));
      notifySaved(
        data.youtubeUrl ? "Zapisano link techniki." : "Usunięto link techniki.",
      );
    } catch {
      notifyError("Błąd sieci przy zapisie.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="app-card space-y-3 p-6">
        <div className="flex items-start gap-3">
          <Dumbbell className="mt-1 h-5 w-5 text-[var(--gym-gold)]" />
          <div>
            <h2 className="font-heading text-xl font-semibold text-white">
              Technika ćwiczeń (YouTube)
            </h2>
            <p className="mt-1 text-sm text-white/55">
              Link z przycisku „technika ↗” w sesji treningu. Puste pole = brak
              przycisku. Ustawione: {withUrl}/{rows.length}.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj nazwy…"
            className="h-11 min-w-0 flex-1 rounded-xl border border-white/12 bg-black/40 px-3 text-sm text-white outline-none focus:border-[var(--gym-gold)]/50"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-11 rounded-xl border border-white/12 bg-black/40 px-3 text-sm text-white"
          >
            <option value="all">Wszystkie partie</option>
            {MUSCLE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/12 bg-black/40 px-3 text-sm text-white/70">
            <input
              type="checkbox"
              checked={onlyMissing}
              onChange={(e) => setOnlyMissing(e.target.checked)}
            />
            Tylko bez linku
          </label>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Odśwież
          </Button>
        </div>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>

      {loading ? (
        <p className="text-sm text-white/50">Wczytywanie…</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((row) => {
            const draft = drafts[row.catalogId] ?? "";
            const dirty = draft.trim() !== (row.youtubeUrl ?? "").trim();
            return (
              <li
                key={row.catalogId}
                className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{row.name}</p>
                  <p className="text-[11px] uppercase tracking-wide text-white/40">
                    {categoryLabel(row.categoryId)}
                  </p>
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-white/35">
                  {row.catalogId}
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={draft}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.catalogId]: e.target.value,
                      }))
                    }
                    placeholder="https://youtu.be/… lub youtube.com/watch?v=…"
                    className="h-11 min-w-0 flex-1 rounded-xl border border-white/12 bg-black/40 px-3 text-sm text-white outline-none focus:border-[var(--gym-gold)]/50"
                  />
                  <Button
                    type="button"
                    disabled={busyId === row.catalogId || !dirty}
                    onClick={() => void saveRow(row.catalogId)}
                    className={cn(!dirty && "opacity-50")}
                  >
                    {busyId === row.catalogId ? "Zapis…" : "Zapisz"}
                  </Button>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 ? (
            <p className="text-sm text-white/45">Brak wyników filtrów.</p>
          ) : null}
        </ul>
      )}
    </div>
  );
}
