"use client";

import { useCallback, useEffect, useState } from "react";
import { Bug, CheckCircle2 } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  AdminCard,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPill,
  type AdminTone,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import {
  BUG_PRIORITY_LABELS,
  BUG_REPORTS_CHANGED_EVENT,
  BUG_STATUSES,
  BUG_STATUS_LABELS,
  bugPriorityRank,
  type BugPriority,
  type BugStatus,
  isBugPriority,
} from "@/lib/bug-reports";
import { adminRequest } from "@/lib/admin-client";
import { cn } from "@/lib/utils";

function notifyBugReportsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BUG_REPORTS_CHANGED_EVENT));
}

type BugRow = {
  id: string;
  description: string;
  expectedBehavior: string;
  stepsToReproduce: string;
  priority: string;
  status: string;
  createdAt: Date | string | number;
  resolvedAt: Date | string | number | null;
  reporterEmail: string;
  reporterName: string | null;
  reporterFirstName: string | null;
  reporterLastName: string | null;
  photos?: string[];
};

const PRIORITY_TONE: Record<BugPriority, AdminTone> = {
  critical: "danger",
  high: "warn",
  normal: "gold",
  low: "info",
};

type StatusAction = { status: BugStatus; label: string; primary?: boolean };

const STATUS_ACTIONS: Record<BugStatus, StatusAction[]> = {
  analysis: [
    { status: "in_progress", label: "Zacznij naprawę", primary: true },
    { status: "retest", label: "Do retestu" },
  ],
  in_progress: [
    { status: "retest", label: "Do retestu", primary: true },
    { status: "analysis", label: "Wróć do analizy" },
  ],
  retest: [
    { status: "fixed", label: "Oznacz jako naprawiony", primary: true },
    { status: "in_progress", label: "Wróć do naprawy" },
    { status: "analysis", label: "Wróć do analizy" },
  ],
  fixed: [
    { status: "retest", label: "Do retestu" },
    { status: "analysis", label: "Wróć do analizy" },
  ],
};

const EMPTY_HINT: Record<BugStatus, string> = {
  analysis: "Wszystkie zgłoszenia zostały przeanalizowane.",
  in_progress: "Nic nie jest aktualnie w naprawie.",
  retest: "Nic nie czeka na retest.",
  fixed: "Jeszcze nic nie oznaczono jako naprawione.",
};

function formatWhen(value: Date | string | number | null | undefined): string {
  if (value == null) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });
}

function reporterLabel(row: BugRow): string {
  const name = [row.reporterFirstName, row.reporterLastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (row.reporterName?.trim()) return row.reporterName.trim();
  return row.reporterEmail;
}

function sortBugs(rows: BugRow[]): BugRow[] {
  return [...rows].sort((a, b) => {
    const pa = isBugPriority(a.priority) ? bugPriorityRank(a.priority) : 99;
    const pb = isBugPriority(b.priority) ? bugPriorityRank(b.priority) : 99;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-white/85">{children}</p>
    </div>
  );
}

export function AdminBugsClient() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [tab, setTab] = useState<BugStatus>("analysis");
  const [bugs, setBugs] = useState<BugRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    async (status: BugStatus) => {
      setLoading(true);
      const res = await adminRequest<{ bugs?: BugRow[] }>(
        `/api/admin/bug-reports?status=${encodeURIComponent(status)}`,
        { fallbackError: "Nie udało się wczytać zgłoszeń." },
      );
      if (!res.ok || !res.data.bugs) {
        notifyError(res.ok ? "Nie udało się wczytać zgłoszeń." : res.error);
        setBugs([]);
      } else {
        setBugs(sortBugs(res.data.bugs));
        notifyBugReportsChanged();
      }
      setLoading(false);
    },
    [notifyError],
  );

  useEffect(() => {
    void load(tab);
  }, [load, tab]);

  async function setStatus(id: string, status: BugStatus) {
    setBusyId(id);
    const res = await adminRequest(`/api/admin/bug-reports/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { status },
      fallbackError: "Nie udało się zaktualizować zgłoszenia.",
    });
    setBusyId(null);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySaved(`Status: ${BUG_STATUS_LABELS[status]}.`);
    setBugs((prev) => prev.filter((b) => b.id !== id));
    notifyBugReportsChanged();
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={<Bug />}
        title="Zgłoszenia błędów"
        description="Przepływ: Analiza → W naprawie → Do retestu → Naprawiony. Najpilniejsze zgłoszenia są na górze."
      />

      <div
        role="tablist"
        aria-label="Status zgłoszeń"
        className="flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-black/25 p-1.5"
      >
        {BUG_STATUSES.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors sm:flex-none",
              tab === id
                ? "bg-[var(--gym-gold)]/15 text-[var(--gym-gold)] ring-1 ring-[var(--gym-gold)]/35"
                : "text-white/55 hover:bg-white/[0.05] hover:text-white/85",
            )}
          >
            {BUG_STATUS_LABELS[id]}
          </button>
        ))}
      </div>

      {loading ? (
        <AdminLoading label="Wczytywanie zgłoszeń…" />
      ) : bugs.length === 0 ? (
        <AdminCard>
          <AdminEmpty
            icon={<CheckCircle2 />}
            title={`Brak zgłoszeń: ${BUG_STATUS_LABELS[tab]}`}
            description={EMPTY_HINT[tab]}
          />
        </AdminCard>
      ) : (
        <ul className="space-y-3">
          {bugs.map((bug) => {
            const priority = isBugPriority(bug.priority) ? bug.priority : null;
            const legacyExpected = bug.expectedBehavior?.trim();
            const legacySteps = bug.stepsToReproduce?.trim();
            const busy = busyId === bug.id;
            return (
              <li key={bug.id}>
                <AdminCard bodyClassName="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {priority ? (
                          <AdminPill tone={PRIORITY_TONE[priority]}>
                            {BUG_PRIORITY_LABELS[priority]}
                          </AdminPill>
                        ) : null}
                        <span className="text-xs text-white/40">{formatWhen(bug.createdAt)}</span>
                      </div>
                      <p className="text-xs text-white/50">
                        Zgłosił: <span className="text-white/75">{reporterLabel(bug)}</span> ·{" "}
                        {bug.reporterEmail}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_ACTIONS[tab].map((action) => (
                        <Button
                          key={action.status}
                          type="button"
                          size="sm"
                          variant={action.primary ? "default" : "secondary"}
                          disabled={busy}
                          onClick={() => void setStatus(bug.id, action.status)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Field label="Opis">{bug.description}</Field>
                    {legacyExpected ? <Field label="Jak powinno wyglądać">{legacyExpected}</Field> : null}
                    {legacySteps ? <Field label="Kroki odtworzenia">{legacySteps}</Field> : null}
                    {bug.photos && bug.photos.length > 0 ? (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                          Zdjęcia
                        </p>
                        <ul className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                          {bug.photos.map((src, i) => (
                            <li key={`${bug.id}-photo-${i}`}>
                              <a
                                href={src}
                                target="_blank"
                                rel="noreferrer"
                                className="block overflow-hidden rounded-lg border border-white/12 bg-black/40"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={src}
                                  alt={`Załącznik ${i + 1}`}
                                  className="aspect-square w-full object-cover"
                                />
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {(tab === "retest" || tab === "fixed") && bug.resolvedAt ? (
                      <p className="text-xs text-white/40">
                        {tab === "retest" ? "Przekazano do retestu" : "Naprawiono"}:{" "}
                        {formatWhen(bug.resolvedAt)}
                      </p>
                    ) : null}
                  </div>
                </AdminCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
