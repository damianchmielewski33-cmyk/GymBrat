"use client";

import { useCallback, useEffect, useState } from "react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import type { CatalogMeal } from "@/lib/meal-catalog-types";

const PLACEHOLDER_JSON = `[]`;

export function AdminCatalogClient() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [jsonText, setJsonText] = useState("");
  const [dbMeals, setDbMeals] = useState<CatalogMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);

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

  async function submitImport(mode: "merge" | "replace") {
    setBusy(true);
    setError(null);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        throw new Error("Niepoprawny JSON — sprawdź składnię.");
      }
      const body = Array.isArray(parsed)
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
        | {
            ok?: boolean;
            error?: string;
            upserted?: number;
            totalMerged?: number;
            removed?: number;
          }
        | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "Import nie powiódł się.");
      }

      if (mode === "replace") {
        notifySaved(
          `Zastąpiono bazę: ${data?.upserted ?? 0} przepisów w Dietcie.`,
        );
      } else {
        notifySaved(
          `Dodano / zaktualizowano ${data?.upserted ?? 0} przepisów (łącznie: ${data?.totalMerged ?? "—"}).`,
        );
      }
      setJsonText("");
      setReplaceOpen(false);
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
    if (!confirm("Usunąć wszystkie przepisy? Dieta będzie pusta do kolejnego importu.")) {
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

  const canSubmit = jsonText.trim().length > 0 && !busy;
  const recipeCount = loading ? null : dbMeals.length;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1408] via-[#0c0c0c] to-[#0a1210] p-6 sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--neon)]/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl"
          aria-hidden
        />
        <div className="relative rounded-2xl border border-white/10 bg-black/35 px-5 py-8 text-center backdrop-blur-sm sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
            Przepisy w aplikacji
          </p>
          <p className="font-heading mt-3 text-6xl font-semibold tabular-nums text-[var(--neon)] sm:text-7xl">
            {recipeCount == null ? "…" : recipeCount}
          </p>
          <p className="mt-3 text-sm text-white/50">
            widoczne w Dietcie · zarządzane z panelu
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="glass-panel neon-glow space-y-4 p-5 sm:p-6">
        <label className="block text-sm text-white/70">
          Plik JSON (opcjonalnie)
          <input
            type="file"
            accept="application/json,.json"
            className="mt-1 block w-full text-xs text-white/60 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          rows={16}
          spellCheck={false}
          placeholder={PLACEHOLDER_JSON}
          className="w-full rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs text-white/90 outline-none placeholder:text-white/25 focus:border-[var(--neon)]/50"
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submitImport("merge")}
          >
            {busy ? "Zapisywanie…" : "Dodaj"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canSubmit}
            onClick={() => setReplaceOpen(true)}
            className="border-amber-500/40 text-amber-100 hover:bg-amber-500/10"
          >
            Zastąp bazę…
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy || !jsonText.trim()}
            onClick={() => setJsonText("")}
            className="text-white/55"
          >
            Wyczyść pole
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || dbMeals.length === 0}
            onClick={() => void clearDb()}
            className="ml-auto border-white/15 text-white/70"
          >
            Wyczyść bazę panelu
          </Button>
        </div>
      </div>

      <AlertDialog open={replaceOpen} onOpenChange={setReplaceOpen}>
        <AlertDialogContent className="border border-white/10 bg-[#0c0c0c] p-6">
          <AlertDialogTitle>Zastąpić całą bazę panelu?</AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-white/65">
            Wszystkie przepisy w aplikacji zostaną usunięte i zastąpione treścią z
            pola JSON. Tej operacji nie da się cofnąć.
          </AlertDialogDescription>
          <div className="mt-6 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => setReplaceOpen(false)}
            >
              Anuluj
            </Button>
            <Button
              type="button"
              className="flex-1 bg-amber-600 text-white hover:bg-amber-500"
              disabled={busy || !jsonText.trim()}
              onClick={() => void submitImport("replace")}
            >
              {busy ? "Zapisywanie…" : "Zastąp bazę"}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

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
                    Brak przepisów — wklej JSON i kliknij Dodaj.
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
