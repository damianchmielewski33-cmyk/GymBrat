"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCopy,
  Database,
  RefreshCw,
  Settings2,
  XCircle,
} from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  AdminCard,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminPill,
  type AdminTone,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { adminRequest } from "@/lib/admin-client";
import {
  formatHostingFunctionCount,
  type ConfigGroupId,
  type ConfigIntegration,
  type ConfigLevel,
  type ConfigStatus,
  type ConfigSummary,
} from "@/lib/admin-config-status";
import { cn } from "@/lib/utils";

type ConfigPayload = {
  groups: Record<ConfigGroupId, { label: string; description: string }>;
  integrations: ConfigIntegration[];
  summary: ConfigSummary;
};

type Usage = { usedMb: number; softMb: number; hardMb: number; overSoft: boolean; overHard: boolean };
type CleanupPreview = { usage: Usage };
type CleanupResult = {
  deleted: Record<string, number>;
  usage: Usage;
  usageAfter: Usage;
};

type Filter = "all" | "todo" | "ok";

const GROUP_ORDER: ConfigGroupId[] = ["core", "users", "content", "monitoring", "mobile"];

const LEVEL_LABEL: Record<ConfigLevel, { label: string; tone: AdminTone }> = {
  required: { label: "Wymagane", tone: "danger" },
  recommended: { label: "Zalecane", tone: "warn" },
  optional: { label: "Opcjonalne", tone: "neutral" },
};

const STATUS_LABEL: Record<ConfigStatus, { label: string; tone: AdminTone }> = {
  ok: { label: "Działa", tone: "ok" },
  partial: { label: "Częściowo", tone: "warn" },
  missing: { label: "Brak", tone: "neutral" },
};

function envTemplate(items: ConfigIntegration[]): string {
  return items
    .flatMap((i) => i.missing)
    .map((name) => `${name}=`)
    .join("\n");
}

function IntegrationCard({
  item,
  onCopy,
}: {
  item: ConfigIntegration;
  onCopy: (item: ConfigIntegration) => void;
}) {
  const level = LEVEL_LABEL[item.level];
  const status = STATUS_LABEL[item.status];
  const StatusIcon =
    item.status === "ok" ? CheckCircle2 : item.status === "partial" ? AlertTriangle : Circle;
  // Brak opcjonalnej integracji to stan normalny — nie podkreślamy go jako problemu.
  const attention = item.status !== "ok" && item.level !== "optional";

  return (
    <li
      className={cn(
        "rounded-2xl border bg-black/25 p-4",
        attention ? "border-amber-400/25" : "border-white/10",
      )}
    >
      <div className="flex items-start gap-3">
        <StatusIcon
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0",
            item.status === "ok"
              ? "text-emerald-300"
              : item.status === "partial"
                ? "text-amber-300"
                : "text-white/30",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{item.label}</h3>
            <AdminPill tone={status.tone}>{status.label}</AdminPill>
            <AdminPill tone={level.tone}>{level.label}</AdminPill>
          </div>
          <p className="text-xs text-white/50">{item.description}</p>

          {item.status !== "ok" ? (
            <div className="space-y-1.5">
              <p className="text-xs leading-relaxed text-amber-100/80">
                <span className="font-semibold">Skutek: </span>
                {item.effectWhenMissing}
              </p>
              <p className="text-xs leading-relaxed text-white/55">
                <span className="font-semibold text-white/70">Na hostingu: </span>
                {item.hostingHint}
              </p>
            </div>
          ) : null}

          <ul className="flex flex-wrap gap-1.5 pt-0.5">
            {item.vars.map((v) => (
              <li
                key={v.name}
                title={
                  v.aliases.length
                    ? `Akceptowane też: ${v.aliases.join(", ")}`
                    : v.hint
                }
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[11px]",
                  v.present
                    ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                    : v.optional
                      ? "border-white/10 bg-white/[0.03] text-white/40"
                      : "border-rose-400/30 bg-rose-500/10 text-rose-100",
                )}
              >
                {v.present ? (
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                ) : (
                  <XCircle className="h-3 w-3" aria-hidden />
                )}
                {v.name}
                {v.optional ? <span className="font-sans text-[10px] opacity-70">(opc.)</span> : null}
              </li>
            ))}
          </ul>

          {item.missing.length > 0 || item.link ? (
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              {item.missing.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onCopy(item)}
                  className="inline-flex items-center gap-1.5 font-medium text-[var(--gym-gold)] hover:underline"
                >
                  <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
                  Kopiuj brakujące zmienne
                </button>
              ) : null}
              {item.link ? (
                <Link
                  href={item.link.href}
                  className="inline-flex items-center gap-1 font-medium text-white/60 hover:text-white"
                >
                  {item.link.label}
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function StorageBar({ usage }: { usage: Usage }) {
  const pct = Math.min(100, (usage.usedMb / Math.max(1, usage.hardMb)) * 100);
  const softPct = Math.min(100, (usage.softMb / Math.max(1, usage.hardMb)) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs text-white/60">
        <span>
          <span className="font-semibold tabular-nums text-white">{usage.usedMb.toFixed(1)} MB</span>{" "}
          z {usage.hardMb} MB
        </span>
        <span>miękki limit {usage.softMb} MB</span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            "h-full rounded-full",
            usage.overHard
              ? "bg-rose-400"
              : usage.overSoft
                ? "bg-amber-400"
                : "bg-gradient-to-r from-[var(--gym-gold-deep)] to-[var(--gym-gold-bright)]",
          )}
          style={{ width: `${pct}%` }}
        />
        <span
          className="absolute inset-y-0 w-px bg-white/50"
          style={{ left: `${softPct}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

export function AdminSettingsClient() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [data, setData] = useState<ConfigPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const [cleanup, setCleanup] = useState<CleanupPreview | null>(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [cfg, prev] = await Promise.all([
      adminRequest<ConfigPayload>("/api/admin/config-status", {
        fallbackError: "Nie udało się wczytać konfiguracji.",
      }),
      adminRequest<CleanupPreview>("/api/admin/maintenance/cleanup"),
    ]);
    if (cfg.ok) setData(cfg.data);
    else setError(cfg.error);
    if (prev.ok) setCleanup(prev.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = useCallback(
    async (text: string, okMessage: string) => {
      try {
        await navigator.clipboard.writeText(text);
        notifySaved(okMessage);
      } catch {
        notifyError("Nie udało się skopiować — skopiuj ręcznie.");
      }
    },
    [notifySaved, notifyError],
  );

  async function runCleanup() {
    setCleanupBusy(true);
    const res = await adminRequest<CleanupResult>("/api/admin/maintenance/cleanup", {
      method: "POST",
      fallbackError: "Sprzątanie nie powiodło się.",
    });
    setCleanupBusy(false);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    const removed = Object.values(res.data.deleted ?? {}).reduce((a, b) => a + b, 0);
    notifySaved(
      `Sprzątanie zakończone: usunięto ${removed} wpisów, zajęte ${res.data.usageAfter.usedMb.toFixed(1)} MB.`,
    );
    setCleanup({ usage: res.data.usageAfter });
  }

  const todo = useMemo(
    () =>
      (data?.integrations ?? []).filter(
        (i) => i.status !== "ok" && i.level !== "optional",
      ),
    [data],
  );

  const grouped = useMemo(() => {
    if (!data) return [];
    return GROUP_ORDER.map((id) => {
      const items = data.integrations.filter((i) => {
        if (i.group !== id) return false;
        if (filter === "ok") return i.status === "ok";
        if (filter === "todo") return i.status !== "ok";
        return true;
      });
      return { id, meta: data.groups[id], items };
    }).filter((g) => g.items.length > 0);
  }, [data, filter]);

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={<Settings2 />}
        title="Konfiguracja"
        description="Sprawdź, które integracje są podłączone i czego brakuje. Wartości zmiennych nigdy nie są pokazywane — widzisz tylko, czy są ustawione."
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} aria-hidden />
            Sprawdź ponownie
          </Button>
        }
      />

      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}
      {loading && !data ? <AdminLoading label="Sprawdzanie konfiguracji…" /> : null}

      {summary ? (
        <AdminCard>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "font-heading text-5xl font-semibold tabular-nums",
                  summary.requiredIssues > 0
                    ? "text-rose-300"
                    : summary.recommendedIssues > 0
                      ? "text-amber-200"
                      : "text-emerald-300",
                )}
              >
                {summary.readiness}%
              </span>
              <span className="text-xs text-white/45">gotowości</span>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--gym-gold-deep)] to-[var(--gym-gold-bright)] transition-[width] duration-700"
                  style={{ width: `${summary.readiness}%` }}
                />
              </div>
              <p className="text-sm text-white/65">
                {summary.hostingIssues > 0
                  ? `Trzeba skonfigurować na hostingu ${formatHostingFunctionCount(summary.hostingIssues)}${
                      summary.requiredIssues > 0
                        ? ` (w tym ${summary.requiredIssues} wymaganych).`
                        : "."
                    }`
                  : "Wszystkie wymagane i zalecane integracje są skonfigurowane na hostingu."}
              </p>
            </div>
            {todo.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                className="shrink-0"
                onClick={() =>
                  void copy(
                    envTemplate(todo),
                    "Skopiowano szablon brakujących zmiennych.",
                  )
                }
              >
                <ClipboardCopy className="mr-2 h-4 w-4" aria-hidden />
                Kopiuj szablon .env
              </Button>
            ) : null}
          </div>
        </AdminCard>
      ) : null}

      {data ? (
        <>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtr integracji">
            {(
              [
                ["all", "Wszystkie"],
                ["todo", "Do skonfigurowania"],
                ["ok", "Działają"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                  filter === id
                    ? "border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]"
                    : "border-white/12 text-white/60 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {grouped.length === 0 ? (
            <AdminCard>
              <p className="py-4 text-center text-sm text-white/50">
                Brak integracji w tym filtrze.
              </p>
            </AdminCard>
          ) : (
            grouped.map((g) => (
              <AdminCard key={g.id} title={g.meta.label} description={g.meta.description}>
                <ul className="grid gap-3 xl:grid-cols-2">
                  {g.items.map((item) => (
                    <IntegrationCard
                      key={item.id}
                      item={item}
                      onCopy={(i) =>
                        void copy(envTemplate([i]), `Skopiowano zmienne: ${i.label}.`)
                      }
                    />
                  ))}
                </ul>
              </AdminCard>
            ))
          )}

          <AdminNotice tone="info">
            <span className="font-semibold text-white/90">Jak ustawić zmienne? </span>
            Dodaj je w panelu hostingu (Vercel → Settings → Environment Variables albo Render →
            Environment), a następnie wykonaj Redeploy. Lokalnie wpisz je do pliku{" "}
            <span className="font-mono text-white/80">.env.local</span>. Potem kliknij „Sprawdź
            ponownie”.
          </AdminNotice>
        </>
      ) : null}

      <AdminCard
        title="Utrzymanie bazy danych"
        description="Usuwa stare logi, odsłony, wygasłe kody i inne dane tymczasowe. Konta, treningi, posiłki, wagi i zdjęcia użytkowników nie są ruszane."
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={cleanupBusy || !cleanup}
            onClick={() => setCleanupOpen(true)}
          >
            <Database className="mr-2 h-4 w-4" aria-hidden />
            {cleanupBusy ? "Sprzątanie…" : "Uruchom sprzątanie"}
          </Button>
        }
      >
        {cleanup ? (
          <div className="space-y-3">
            <StorageBar usage={cleanup.usage} />
            {cleanup.usage.overHard ? (
              <AdminNotice tone="danger">
                Przekroczono twardy limit bazy — uruchom sprzątanie lub zwiększ plan Turso.
              </AdminNotice>
            ) : cleanup.usage.overSoft ? (
              <AdminNotice tone="warn">
                Przekroczono miękki limit bazy — rozważ sprzątanie.
              </AdminNotice>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-white/45">
            {loading ? "Pomiar zajętości…" : "Nie udało się odczytać zajętości bazy."}
          </p>
        )}
      </AdminCard>

      <ConfirmDialog
        open={cleanupOpen}
        onOpenChange={setCleanupOpen}
        onConfirm={() => void runCleanup()}
        pending={cleanupBusy}
        title="Uruchomić sprzątanie bazy?"
        description="Zostaną usunięte stare dane tymczasowe zgodnie z polityką retencji. Tej operacji nie można cofnąć."
        confirmLabel="Uruchom sprzątanie"
      />
    </div>
  );
}
