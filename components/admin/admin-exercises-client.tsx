"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dumbbell, ExternalLink, RefreshCw, Search } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  AdminCard,
  AdminEmpty,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminPill,
  AdminSelect,
  AdminStat,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminRequest } from "@/lib/admin-client";
import { MUSCLE_CATEGORIES, categoryLabel } from "@/lib/workout-exercise-catalog";
import { normalizeYoutubeUrl } from "@/lib/youtube-url";

type Row = {
  catalogId: string;
  name: string;
  categoryId: string;
  youtubeUrl: string | null;
};

const PAGE_SIZE = 40;

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
  const [visible, setVisible] = useState(PAGE_SIZE);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await adminRequest<{ rows?: Row[] }>("/api/admin/exercises/technique", {
      fallbackError: "Nie udało się wczytać listy ćwiczeń.",
    });
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    const list = Array.isArray(res.data.rows) ? res.data.rows : [];
    setRows(list);
    setDrafts(Object.fromEntries(list.map((r) => [r.catalogId, r.youtubeUrl ?? ""])));
    setLoading(false);
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
  const pct = rows.length ? Math.round((withUrl / rows.length) * 100) : 0;

  async function saveRow(catalogId: string) {
    const youtubeUrl = drafts[catalogId] ?? "";
    if (youtubeUrl.trim() && !normalizeYoutubeUrl(youtubeUrl)) {
      notifyError("Podaj poprawny link YouTube (youtube.com / youtu.be).");
      return;
    }
    setBusyId(catalogId);
    const res = await adminRequest<{ youtubeUrl?: string | null }>(
      "/api/admin/exercises/technique",
      {
        method: "PUT",
        body: { catalogId, youtubeUrl },
        fallbackError: "Zapis nie powiódł się.",
      },
    );
    setBusyId(null);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    const saved = res.data.youtubeUrl ?? null;
    setRows((prev) =>
      prev.map((r) => (r.catalogId === catalogId ? { ...r, youtubeUrl: saved } : r)),
    );
    setDrafts((prev) => ({ ...prev, [catalogId]: saved ?? "" }));
    notifySaved(saved ? "Zapisano link techniki." : "Usunięto link techniki.");
  }

  const shown = filtered.slice(0, visible);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={<Dumbbell />}
        title="Technika ćwiczeń"
        description="Opcjonalny link YouTube dla ćwiczeń z katalogu. Główne linki „technika ↗” ustawiasz przy układaniu planu (Profil → Plan treningowy)."
        actions={
          <Button type="button" variant="outline" disabled={loading} onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Odśwież
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <AdminStat label="Ćwiczeń w katalogu" value={rows.length} />
        <AdminStat label="Z linkiem" value={withUrl} tone="ok" hint={`${pct}% pokrycia`} />
        <AdminStat
          label="Bez linku"
          value={rows.length - withUrl}
          tone={rows.length - withUrl > 0 ? "warn" : "ok"}
        />
      </div>

      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

      <AdminCard flush>
        <div className="flex flex-col gap-2 border-b border-white/10 p-4 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisible(PAGE_SIZE);
              }}
              placeholder="Szukaj nazwy, partii lub id…"
              aria-label="Szukaj ćwiczeń"
              className="pl-9"
            />
          </div>
          <AdminSelect
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setVisible(PAGE_SIZE);
            }}
            aria-label="Partia mięśniowa"
            className="lg:w-56"
          >
            <option value="all">Wszystkie partie</option>
            {MUSCLE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </AdminSelect>
          <label className="flex h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-white/20 bg-black/50 px-3 text-sm text-white/75">
            <input
              type="checkbox"
              checked={onlyMissing}
              onChange={(e) => {
                setOnlyMissing(e.target.checked);
                setVisible(PAGE_SIZE);
              }}
              className="h-4 w-4 accent-[var(--gym-gold)]"
            />
            Tylko bez linku
          </label>
        </div>

        {loading ? (
          <AdminLoading label="Wczytywanie ćwiczeń…" />
        ) : filtered.length === 0 ? (
          <AdminEmpty
            icon={<Dumbbell />}
            title="Brak wyników"
            description="Zmień frazę wyszukiwania lub filtry."
          />
        ) : (
          <ul className="divide-y divide-white/10">
            {shown.map((row) => {
              const draft = drafts[row.catalogId] ?? "";
              const dirty = draft.trim() !== (row.youtubeUrl ?? "").trim();
              const busy = busyId === row.catalogId;
              return (
                <li key={row.catalogId} className="space-y-3 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">{row.name}</p>
                    <AdminPill>{categoryLabel(row.categoryId)}</AdminPill>
                    {row.youtubeUrl ? (
                      <a
                        href={row.youtubeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[var(--gym-gold)] hover:underline"
                      >
                        Podgląd
                        <ExternalLink className="h-3 w-3" aria-hidden />
                      </a>
                    ) : (
                      <AdminPill tone="warn">brak linku</AdminPill>
                    )}
                    <span className="ml-auto font-mono text-[11px] text-white/30">
                      {row.catalogId}
                    </span>
                  </div>
                  <form
                    className="flex flex-col gap-2 sm:flex-row"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (dirty && !busy) void saveRow(row.catalogId);
                    }}
                  >
                    <Input
                      value={draft}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [row.catalogId]: e.target.value }))
                      }
                      placeholder="https://youtu.be/… lub youtube.com/watch?v=…"
                      aria-label={`Link YouTube: ${row.name}`}
                      className="flex-1"
                    />
                    <Button type="submit" disabled={busy || !dirty} className="sm:w-28">
                      {busy ? "Zapis…" : "Zapisz"}
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && filtered.length > shown.length ? (
          <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
            <p className="text-xs text-white/45">
              Pokazano {shown.length} z {filtered.length}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
            >
              Pokaż więcej
            </Button>
          </div>
        ) : null}
      </AdminCard>
    </div>
  );
}
