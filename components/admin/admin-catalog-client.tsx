"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { parseCatalogImportPayload } from "@/lib/meal-catalog-import";
import { MEAL_CATALOG_AI_PROMPT } from "@/lib/meal-catalog-ai-prompt";
import { MEAL_SLOT_LABELS, type MealSlot } from "@/lib/meal-catalog";
import { useI18n } from "@/components/i18n/i18n-provider";
import { formatMessage } from "@/lib/i18n/format";
import { Check, Copy } from "lucide-react";

const PLACEHOLDER_JSON = `[]`;

type ValidationState =
  | { status: "empty" }
  | { status: "invalid"; message: string }
  | {
      status: "ok";
      count: number;
      bySlot: Partial<Record<MealSlot, number>>;
    };

function validateJsonText(text: string): ValidationState {
  const trimmed = text.trim();
  if (!trimmed) return { status: "empty" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { status: "invalid", message: "Niepoprawna składnia JSON." };
  }
  try {
    const { meals } = parseCatalogImportPayload(parsed);
    const bySlot: Partial<Record<MealSlot, number>> = {};
    for (const m of meals) {
      bySlot[m.slot] = (bySlot[m.slot] ?? 0) + 1;
    }
    return { status: "ok", count: meals.length, bySlot };
  } catch (e) {
    return {
      status: "invalid",
      message: e instanceof Error ? e.message : "Walidacja nie powiodła się.",
    };
  }
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminCatalogClient() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const { t } = useI18n();
  const [jsonText, setJsonText] = useState("");
  const [dbMeals, setDbMeals] = useState<CatalogMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);

  const validation = useMemo(() => validateJsonText(jsonText), [jsonText]);

  async function copyAiPrompt() {
    try {
      await navigator.clipboard.writeText(MEAL_CATALOG_AI_PROMPT);
      setPromptCopied(true);
      notifySaved("Skopiowano prompt dla AI.");
      window.setTimeout(() => setPromptCopied(false), 2000);
    } catch {
      notifyError("Nie udało się skopiować — zaznacz tekst ręcznie.");
    }
  }

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

  async function loadStarterPack() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/catalog?pack=starter");
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; meals?: unknown; error?: string }
        | null;
      if (!res.ok || !data?.meals) {
        throw new Error(data?.error ?? "Nie udało się wczytać pakietu startowego.");
      }
      setJsonText(JSON.stringify(data.meals, null, 2));
      notifySaved("Załadowano pakiet startowy do pola JSON — kliknij Dodaj lub Zastąp.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Pakiet startowy niedostępny.";
      setError(msg);
      notifyError(msg);
    } finally {
      setBusy(false);
    }
  }

  function exportDb() {
    if (dbMeals.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(`gymbrat-katalog-${stamp}.json`, dbMeals);
    notifySaved(`Wyeksportowano ${dbMeals.length} przepisów.`);
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
      // Ta sama walidacja co na serwerze — wczesny komunikat.
      parseCatalogImportPayload(
        Array.isArray(parsed) ? { mode, meals: parsed } : { ...(parsed as object), mode },
      );

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

  const canSubmit = validation.status === "ok" && !busy;
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
            {t("adminCatalog.title")}
          </p>
          <p className="font-heading mt-3 text-6xl font-semibold tabular-nums text-[var(--neon)] sm:text-7xl">
            {recipeCount == null ? "…" : recipeCount}
          </p>
          <p className="mt-3 text-sm text-white/50">{t("adminCatalog.subtitle")}</p>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="app-card space-y-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
              Prompt dla AI
            </p>
            <p className="mt-1.5 text-sm text-white/55">
              Skopiuj i wklej do innego modelu AI. Odpowiedź (JSON) wklej poniżej i kliknij
              Dodaj / Zastąp.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void copyAiPrompt()}
            className="shrink-0 border-[var(--gym-gold)]/40 text-[var(--gym-gold)] hover:bg-[var(--gym-gold)]/10"
          >
            {promptCopied ? (
              <>
                <Check className="mr-1.5 h-4 w-4" />
                Skopiowano
              </>
            ) : (
              <>
                <Copy className="mr-1.5 h-4 w-4" />
                Kopiuj prompt
              </>
            )}
          </Button>
        </div>
        <textarea
          readOnly
          value={MEAL_CATALOG_AI_PROMPT}
          rows={14}
          spellCheck={false}
          className="w-full resize-y rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-white/80 outline-none focus:border-[var(--gym-gold)]/40"
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Prompt do generowania katalogu przepisów"
        />
      </div>

      <div className="glass-panel neon-glow space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void loadStarterPack()}
            className="border-[var(--neon)]/40 text-[var(--neon)] hover:bg-[var(--neon)]/10"
          >
            {t("adminCatalog.starterPack")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || dbMeals.length === 0}
            onClick={exportDb}
            className="border-white/15 text-white/70"
          >
            {t("adminCatalog.exportJson")}
          </Button>
        </div>

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

        {validation.status === "ok" ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            <p className="font-semibold">
              {formatMessage(t("adminCatalog.validationOk"), {
                count: validation.count,
              })}
            </p>
            <p className="mt-1 text-xs text-emerald-100/75">
              {Object.entries(validation.bySlot)
                .map(([slot, n]) => `${MEAL_SLOT_LABELS[slot as MealSlot]}: ${n}`)
                .join(" · ")}
            </p>
          </div>
        ) : validation.status === "invalid" ? (
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <p className="font-semibold">{t("adminCatalog.validationTitle")}</p>
            <p className="mt-1 text-xs text-amber-100/80">{validation.message}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submitImport("merge")}
          >
            {busy ? "Zapisywanie…" : t("adminCatalog.add")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canSubmit}
            onClick={() => setReplaceOpen(true)}
            className="border-amber-500/40 text-amber-100 hover:bg-amber-500/10"
          >
            {t("adminCatalog.replace")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy || !jsonText.trim()}
            onClick={() => setJsonText("")}
            className="text-white/55"
          >
            {t("adminCatalog.clearField")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || dbMeals.length === 0}
            onClick={() => void clearDb()}
            className="ml-auto border-white/15 text-white/70"
          >
            {t("adminCatalog.clearDb")}
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
              disabled={busy || !canSubmit}
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
                    Brak przepisów — użyj pakietu startowego albo wklej JSON.
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
