"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  ImagePlus,
  Search,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  AdminCard,
  AdminEmpty,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminPill,
  AdminStat,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/components/i18n/i18n-provider";
import { adminRequest } from "@/lib/admin-client";
import { formatMessage } from "@/lib/i18n/format";
import type { CatalogMeal } from "@/lib/meal-catalog-types";
import {
  extractJsonTextFromAiResponse,
  parseCatalogImportPayload,
} from "@/lib/meal-catalog-import";
import { MEAL_CATALOG_AI_PROMPT } from "@/lib/meal-catalog-ai-prompt";
import { MEAL_SLOT_LABELS, MEAL_SLOTS, type MealSlot } from "@/lib/meal-catalog";

const MAX_IMAGE_ROUNDS = 40;
const TABLE_PAGE = 50;

type ImagesInfo = {
  generated?: number;
  pending?: number;
  hasMore?: boolean;
  failed?: number;
  missingApiKey?: boolean;
  error?: string;
};

type ImagesResponse = { images?: ImagesInfo };
type ImportResponse = ImagesResponse & {
  upserted?: number;
  totalMerged?: number;
  removed?: number;
};

type ValidationState =
  | { status: "empty" }
  | { status: "invalid"; message: string }
  | { status: "ok"; count: number; bySlot: Partial<Record<MealSlot, number>> };

function validateJsonText(text: string): ValidationState {
  const trimmed = extractJsonTextFromAiResponse(text);
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
    for (const m of meals) bySlot[m.slot] = (bySlot[m.slot] ?? 0) + 1;
    return { status: "ok", count: meals.length, bySlot };
  } catch (e) {
    return {
      status: "invalid",
      message: e instanceof Error ? e.message : "Walidacja nie powiodła się.",
    };
  }
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" });
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
  const [clearOpen, setClearOpen] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(TABLE_PAGE);

  const validation = useMemo(() => validateJsonText(jsonText), [jsonText]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await adminRequest<{ dbMeals?: CatalogMeal[] }>("/api/admin/catalog", {
      fallbackError: "Nie udało się wczytać katalogu.",
    });
    if (res.ok) setDbMeals(res.data.dbMeals ?? []);
    else setError(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyAiPrompt() {
    try {
      await navigator.clipboard.writeText(MEAL_CATALOG_AI_PROMPT);
      setPromptCopied(true);
      notifySaved("Skopiowano prompt dla AI.");
      window.setTimeout(() => setPromptCopied(false), 2000);
    } catch {
      notifyError("Nie udało się skopiować — rozwiń prompt i zaznacz tekst ręcznie.");
      setPromptOpen(true);
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setJsonText(await file.text());
  }

  function exportDb() {
    if (dbMeals.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(`gymbrat-katalog-${stamp}.json`, dbMeals);
    notifySaved(`Wyeksportowano ${dbMeals.length} przepisów.`);
  }

  /**
   * Generuje grafiki AI w paczkach, aż skończą się przepisy bez grafiki.
   * `start` — wynik pierwszej paczki zwrócony już przez import (jeśli był).
   * Zwraca liczbę wygenerowanych grafik w całej serii.
   */
  async function runImageBatches(start?: ImagesInfo): Promise<number> {
    let info: ImagesInfo = start ?? { hasMore: true };
    let total = start?.generated ?? 0;

    if (info.missingApiKey) {
      throw new Error(
        info.error ??
          "Przepisy zapisane, ale brak POLLINATIONS_API_KEY — bez klucza grafiki nie powstaną (Konfiguracja → Grafiki przepisów).",
      );
    }

    for (let round = 0; info.hasMore && round < MAX_IMAGE_ROUNDS; round += 1) {
      const res = await adminRequest<ImagesResponse>("/api/admin/catalog/images", {
        method: "POST",
        body: { limit: 8 },
        fallbackError: "Generacja grafik się urwała — kliknij „Dokończ grafiki AI”.",
      });
      if (!res.ok) {
        throw new Error(res.data?.images?.error ?? res.error);
      }
      const next = res.data.images ?? {};
      if (next.missingApiKey) {
        throw new Error(next.error ?? "Brak POLLINATIONS_API_KEY — ustaw klucz i zrób Redeploy.");
      }
      total += next.generated ?? 0;
      if (!next.hasMore && (next.failed ?? 0) > 0 && total === 0) {
        throw new Error(
          "Nie udało się wygenerować grafik AI (Pollinations). Sprawdź klucz i spróbuj „Dokończ grafiki AI”.",
        );
      }
      info = next;
      if (next.hasMore) {
        notifySaved(
          `Generuję grafiki AI… zapisane: ${total}, pozostało: ${next.pending ?? "—"}`,
        );
      }
    }
    return total;
  }

  async function submitImport(mode: "merge" | "replace") {
    setBusy(true);
    setError(null);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(extractJsonTextFromAiResponse(jsonText));
      } catch {
        throw new Error("Niepoprawny JSON — sprawdź składnię.");
      }
      const body = Array.isArray(parsed)
        ? { mode, meals: parsed }
        : { ...(parsed as object), mode };
      // Ta sama walidacja co na serwerze — wczesny komunikat.
      parseCatalogImportPayload(body);

      const res = await adminRequest<ImportResponse>("/api/admin/catalog", {
        method: "POST",
        body,
        fallbackError: "Import nie powiódł się.",
      });
      if (!res.ok) throw new Error(res.error);

      const images = await runImageBatches(res.data.images ?? { hasMore: false });
      notifySaved(
        mode === "replace"
          ? `Zastąpiono bazę: ${res.data.upserted ?? 0} przepisów, grafik AI: ${images}.`
          : `Dodano / zaktualizowano ${res.data.upserted ?? 0} przepisów (łącznie: ${res.data.totalMerged ?? "—"}), grafik AI: ${images}.`,
      );
      setJsonText("");
      setReplaceOpen(false);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import nie powiódł się.";
      setError(msg);
      notifyError(msg);
      // Przepisy mogły się zapisać mimo błędu grafik — odśwież listę.
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function generateMissingImages() {
    setBusy(true);
    setError(null);
    try {
      const total = await runImageBatches();
      notifySaved(
        total > 0
          ? `Zapisano ${total} grafik AI w bazie.`
          : "Wszystkie przepisy mają już trwałe grafiki (albo brak klucza Pollinations).",
      );
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generacja grafik nie powiodła się.";
      setError(msg);
      notifyError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function clearDb() {
    setBusy(true);
    const res = await adminRequest("/api/admin/catalog", {
      method: "DELETE",
      fallbackError: "Nie udało się wyczyścić katalogu.",
    });
    setBusy(false);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySaved("Wyczyszczono przepisy z bazy.");
    await load();
  }

  const filteredMeals = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dbMeals;
    return dbMeals.filter(
      (m) => m.title.toLowerCase().includes(q) || m.id.toLowerCase().includes(q),
    );
  }, [dbMeals, query]);
  const shownMeals = filteredMeals.slice(0, visible);

  const slotCounts = useMemo(() => {
    const out: Partial<Record<MealSlot, number>> = {};
    for (const m of dbMeals) out[m.slot] = (out[m.slot] ?? 0) + 1;
    return out;
  }, [dbMeals]);

  const canSubmit = validation.status === "ok" && !busy;
  const hasMeals = dbMeals.length > 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={<UtensilsCrossed />}
        title={t("adminCatalog.title")}
        description={`${t("adminCatalog.subtitle")}. Wygeneruj przepisy w AI, wklej JSON i zaimportuj — grafiki powstaną automatycznie.`}
        actions={
          <>
            <Button type="button" variant="outline" disabled={busy || !hasMeals} onClick={exportDb}>
              <Download className="mr-2 h-4 w-4" aria-hidden />
              {t("adminCatalog.exportJson")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !hasMeals}
              onClick={() => void generateMissingImages()}
            >
              <ImagePlus className="mr-2 h-4 w-4" aria-hidden />
              Dokończ grafiki AI
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <AdminStat
          label="Przepisów w bazie"
          value={loading ? "…" : dbMeals.length}
          tone="gold"
        />
        {MEAL_SLOTS.map((slot) => (
          <AdminStat
            key={slot}
            label={MEAL_SLOT_LABELS[slot]}
            value={loading ? "…" : (slotCounts[slot] ?? 0)}
          />
        ))}
      </div>

      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

      <AdminCard
        title="1. Prompt dla AI"
        description="Skopiuj prompt i wklej do innego modelu AI. Odpowiedź (JSON) wklej w kroku 2."
        actions={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPromptOpen((v) => !v)}>
              {promptOpen ? "Ukryj treść" : "Pokaż treść"}
              <ChevronDown
                className={`ml-1.5 h-4 w-4 transition-transform ${promptOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => void copyAiPrompt()}>
              {promptCopied ? (
                <>
                  <Check className="mr-1.5 h-4 w-4" aria-hidden />
                  Skopiowano
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-4 w-4" aria-hidden />
                  Kopiuj prompt
                </>
              )}
            </Button>
          </>
        }
      >
        {promptOpen ? (
          <Textarea
            readOnly
            value={MEAL_CATALOG_AI_PROMPT}
            rows={14}
            spellCheck={false}
            className="resize-y font-mono text-[11px] leading-relaxed"
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Prompt do generowania katalogu przepisów"
          />
        ) : (
          <p className="text-xs text-white/45">
            Prompt jest pod stałe Posiłek 1–5 (tylko makro w profilu) i wymaga zróżnicowanych
            profili B/W/T.
          </p>
        )}
      </AdminCard>

      <AdminCard
        title="2. Import przepisów"
        description="Wgraj plik JSON albo wklej odpowiedź AI. Walidacja działa na bieżąco; grafiki AI generują się raz przy imporcie i są zapisywane w bazie."
      >
        <div className="space-y-4">
          <input
            type="file"
            accept="application/json,.json"
            aria-label="Plik JSON z przepisami"
            className="block w-full text-xs text-white/60 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/15"
            onChange={(e) => {
              void onFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />

          <Textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={12}
            spellCheck={false}
            placeholder="Wklej tutaj JSON z przepisami…"
            aria-label="JSON z przepisami"
            className="resize-y font-mono text-xs"
          />

          {validation.status === "ok" ? (
            <AdminNotice tone="ok">
              <p className="font-semibold">
                {formatMessage(t("adminCatalog.validationOk"), { count: validation.count })}
              </p>
              <p className="mt-0.5 text-xs opacity-80">
                {Object.entries(validation.bySlot)
                  .map(([slot, n]) => `${MEAL_SLOT_LABELS[slot as MealSlot]}: ${n}`)
                  .join(" · ")}
              </p>
            </AdminNotice>
          ) : validation.status === "invalid" ? (
            <AdminNotice tone="warn">
              <p className="font-semibold">{t("adminCatalog.validationTitle")}</p>
              <p className="mt-0.5 text-xs opacity-80">{validation.message}</p>
            </AdminNotice>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!canSubmit} onClick={() => void submitImport("merge")}>
              {busy ? "Zapisywanie…" : `${t("adminCatalog.add")} do bazy`}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!canSubmit}
              onClick={() => setReplaceOpen(true)}
            >
              {t("adminCatalog.replace")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy || !jsonText.trim()}
              onClick={() => setJsonText("")}
            >
              {t("adminCatalog.clearField")}
            </Button>
          </div>
        </div>
      </AdminCard>

      <AdminCard
        title="3. Przepisy w bazie"
        description="To, co użytkownicy widzą w Dietach."
        flush
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || !hasMeals}
            onClick={() => setClearOpen(true)}
            className="border-rose-400/30 text-rose-200 hover:bg-rose-500/10"
          >
            <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
            {t("adminCatalog.clearDb")}
          </Button>
        }
      >
        {hasMeals ? (
          <div className="border-b border-white/10 p-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setVisible(TABLE_PAGE);
                }}
                placeholder="Szukaj po tytule lub id…"
                aria-label="Szukaj przepisów"
                className="pl-9"
              />
            </div>
          </div>
        ) : null}

        {loading ? (
          <AdminLoading label="Wczytywanie przepisów…" />
        ) : !hasMeals ? (
          <AdminEmpty
            icon={<UtensilsCrossed />}
            title="Brak przepisów"
            description="Dieta jest pusta. Wygeneruj przepisy w AI (krok 1) i zaimportuj je (krok 2)."
          />
        ) : filteredMeals.length === 0 ? (
          <AdminEmpty icon={<Search />} title="Brak wyników" description="Zmień frazę wyszukiwania." />
        ) : (
          <div className="max-h-[min(60vh,520px)] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-zinc-950/95 text-[11px] uppercase tracking-wide text-white/45">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Tytuł</th>
                  <th className="px-4 py-2.5 font-medium">Posiłek</th>
                  <th className="px-4 py-2.5 text-right font-medium">Kcal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-white/85">
                {shownMeals.map((m) => (
                  <tr key={m.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5">
                      <p>{m.title}</p>
                      <p className="font-mono text-[11px] text-white/30">{m.id}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <AdminPill>{MEAL_SLOT_LABELS[m.slot] ?? m.slot}</AdminPill>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {Math.round(m.approximateMacros.calories)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredMeals.length > shownMeals.length ? (
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
            <p className="text-xs text-white/45">
              Pokazano {shownMeals.length} z {filteredMeals.length}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setVisible((v) => v + TABLE_PAGE)}
            >
              Pokaż więcej
            </Button>
          </div>
        ) : null}
      </AdminCard>

      <ConfirmDialog
        open={replaceOpen}
        onOpenChange={setReplaceOpen}
        onConfirm={() => void submitImport("replace")}
        pending={busy}
        title="Zastąpić całą bazę przepisów?"
        description="Wszystkie przepisy w aplikacji zostaną usunięte i zastąpione treścią z pola JSON. Tej operacji nie da się cofnąć."
        confirmLabel="Zastąp bazę"
      />
      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        onConfirm={() => void clearDb()}
        pending={busy}
        title="Usunąć wszystkie przepisy?"
        description="Dieta będzie pusta do kolejnego importu. Tej operacji nie da się cofnąć."
        confirmLabel="Usuń wszystkie"
      />
    </div>
  );
}
