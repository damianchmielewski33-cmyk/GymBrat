"use client";

import { useCallback, useEffect, useState } from "react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import {
  BUG_PRIORITIES,
  BUG_PRIORITY_LABELS,
  BUG_REPORTS_CHANGED_EVENT,
  BUG_STATUSES,
  BUG_STATUS_LABELS,
  bugPriorityRank,
  type BugPriority,
  type BugStatus,
  isBugPriority,
} from "@/lib/bug-reports";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
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

const PRIORITY_BADGE: Record<BugPriority, string> = {
  critical: "bg-red-500/20 text-red-200 ring-red-400/40",
  high: "bg-orange-400/20 text-orange-100 ring-orange-300/40",
  normal: "bg-amber-300/20 text-amber-50 ring-amber-200/35",
  low: "bg-sky-400/20 text-sky-100 ring-sky-300/40",
};

const STATUS_ACTIONS: Record<
  BugStatus,
  { status: BugStatus; label: string }[]
> = {
  analysis: [
    { status: "in_progress", label: "W naprawie" },
    { status: "retest", label: "Do retestu" },
  ],
  in_progress: [
    { status: "retest", label: "Do retestu" },
    { status: "analysis", label: "Wróć do analizy" },
  ],
  retest: [
    { status: "fixed", label: "Naprawiony" },
    { status: "in_progress", label: "W naprawie" },
    { status: "analysis", label: "Wróć do analizy" },
  ],
  fixed: [
    { status: "retest", label: "Do retestu" },
    { status: "analysis", label: "Wróć do analizy" },
  ],
};

function formatWhen(value: Date | string | number | null | undefined): string {
  if (value == null) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function reporterLabel(row: BugRow): string {
  const name = [row.reporterFirstName, row.reporterLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (name) return name;
  if (row.reporterName?.trim()) return row.reporterName.trim();
  return row.reporterEmail;
}

function sortBugs(rows: BugRow[]): BugRow[] {
  return [...rows].sort((a, b) => {
    const pa = isBugPriority(a.priority) ? bugPriorityRank(a.priority) : 99;
    const pb = isBugPriority(b.priority) ? bugPriorityRank(b.priority) : 99;
    if (pa !== pb) return pa - pb;
    return (
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });
}

export function AdminBugsClient() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [tab, setTab] = useState<BugStatus>("analysis");
  const [bugs, setBugs] = useState<BugRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (status: BugStatus) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/bug-reports?status=${encodeURIComponent(status)}`,
        { credentials: "include" },
      );
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        bugs?: BugRow[];
        error?: string;
      } | null;
      if (!res.ok || !data?.ok || !data.bugs) {
        notifyError(data?.error ?? "Nie udało się wczytać zgłoszeń.");
        setBugs([]);
        return;
      }
      setBugs(sortBugs(data.bugs));
      notifyBugReportsChanged();
    } catch {
      notifyError("Nie udało się wczytać zgłoszeń.");
      setBugs([]);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    void load(tab);
  }, [load, tab]);

  async function setStatus(id: string, status: BugStatus) {
    setBusyId(id);
    try {
      await ensureCsrfCookie();
      const res = await fetch(`/api/admin/bug-reports/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getXsrfHeaders(),
        },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        notifyError(data?.error ?? "Nie udało się zaktualizować zgłoszenia.");
        return;
      }
      notifySaved(`Status: ${BUG_STATUS_LABELS[status]}.`);
      setBugs((prev) => prev.filter((b) => b.id !== id));
      notifyBugReportsChanged();
    } catch {
      notifyError("Nie udało się zaktualizować zgłoszenia.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="app-card space-y-2 p-5 sm:p-6">
        <h2 className="font-heading text-xl font-semibold text-white">
          Zgłoszenia błędów
        </h2>
        <p className="text-sm text-white/55">
          Workflow: Analiza → W naprawie → Do retestu → Naprawiony. Priorytety:{" "}
          {BUG_PRIORITIES.map((p) => BUG_PRIORITY_LABELS[p]).join(", ")}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-px">
        {BUG_STATUSES.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "relative px-1 pb-2 text-sm font-medium transition-colors",
              tab === id
                ? "text-[var(--gym-gold)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[var(--gym-gold)]"
                : "text-white/55 hover:text-white/80",
            )}
          >
            {BUG_STATUS_LABELS[id]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-white/50">Ładowanie…</p>
        ) : bugs.length === 0 ? (
          <div className="app-card p-6 text-sm text-white/50">
            Brak zgłoszeń w statusie „{BUG_STATUS_LABELS[tab]}”.
          </div>
        ) : (
          <ul className="space-y-3">
            {bugs.map((bug) => {
              const priority = isBugPriority(bug.priority)
                ? bug.priority
                : null;
              const legacyExpected = bug.expectedBehavior?.trim();
              const legacySteps = bug.stepsToReproduce?.trim();
              return (
                <li key={bug.id} className="app-card space-y-3 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {priority ? (
                          <span
                            className={cn(
                              "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1",
                              PRIORITY_BADGE[priority],
                            )}
                          >
                            {BUG_PRIORITY_LABELS[priority]}
                          </span>
                        ) : null}
                        <span className="text-[11px] text-white/40">
                          {formatWhen(bug.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-white/45">
                        Zgłosił: {reporterLabel(bug)} ({bug.reporterEmail})
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_ACTIONS[tab].map((action) => (
                        <Button
                          key={action.status}
                          type="button"
                          size="sm"
                          variant={
                            action.status === "fixed" ||
                            action.status === "retest" ||
                            (tab === "analysis" && action.status === "in_progress")
                              ? "default"
                              : "secondary"
                          }
                          disabled={busyId === bug.id}
                          onClick={() => void setStatus(bug.id, action.status)}
                        >
                          {busyId === bug.id ? "…" : action.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                        Opis
                      </p>
                      <p className="whitespace-pre-wrap text-white/90">
                        {bug.description}
                      </p>
                    </div>
                    {legacyExpected ? (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                          Jak powinno wyglądać
                        </p>
                        <p className="whitespace-pre-wrap text-white/80">
                          {legacyExpected}
                        </p>
                      </div>
                    ) : null}
                    {legacySteps ? (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                          Kroki odtworzenia
                        </p>
                        <p className="whitespace-pre-wrap text-white/80">
                          {legacySteps}
                        </p>
                      </div>
                    ) : null}
                    {bug.photos && bug.photos.length > 0 ? (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                          Zdjęcia
                        </p>
                        <ul className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                    {tab === "retest" && bug.resolvedAt ? (
                      <p className="text-[11px] text-white/40">
                        Przekazano do retestu: {formatWhen(bug.resolvedAt)}
                      </p>
                    ) : null}
                    {tab === "fixed" && bug.resolvedAt ? (
                      <p className="text-[11px] text-white/40">
                        Naprawiono: {formatWhen(bug.resolvedAt)}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
