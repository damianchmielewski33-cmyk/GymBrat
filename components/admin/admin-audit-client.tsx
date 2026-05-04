"use client";

import { useCallback, useEffect, useState } from "react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import type { AdminAuditEntry } from "@/lib/admin-audit-types";
import { Button } from "@/components/ui/button";

export function AdminAuditClient() {
  const { notifyError } = useSaveFeedback();
  const [entries, setEntries] = useState<AdminAuditEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/audit?limit=200", { credentials: "include" });
      const j = (await res.json().catch(() => null)) as
        | { ok?: boolean; entries?: AdminAuditEntry[] }
        | null;
      if (!res.ok || !j?.ok || !Array.isArray(j.entries)) {
        notifyError("Nie udało się wczytać dziennika.");
        setEntries([]);
        return;
      }
      setEntries(
        j.entries.map((e) => ({
          ...e,
          createdAt: new Date(e.createdAt as unknown as string),
        })),
      );
    } catch {
      notifyError("Nie udało się wczytać dziennika.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="glass-panel neon-glow space-y-4 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">
            Bezpieczeństwo
          </p>
          <h2 className="font-heading mt-1 text-lg font-semibold text-white">
            Dziennik zmian administratora
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Kto zmienił ustawienia AI globalnie, role użytkowników i dostęp do funkcji AI.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="border-white/15"
          disabled={loading}
          onClick={() => void load()}
        >
          Odśwież
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-white/55">Ładowanie…</p>
      ) : !entries?.length ? (
        <p className="text-sm text-white/55">Brak wpisów.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-xs text-white/80">
            <thead className="bg-white/[0.04] text-[10px] uppercase tracking-wide text-white/45">
              <tr>
                <th className="px-3 py-2 font-medium">Czas</th>
                <th className="px-3 py-2 font-medium">Akcja</th>
                <th className="px-3 py-2 font-medium">Cel</th>
                <th className="px-3 py-2 font-medium">Szczegóły</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {entries.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-white/60">
                    {e.createdAt.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-[var(--neon)]">
                    {e.action}
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-2 font-mono text-[10px] text-white/50">
                    {e.targetUserId ?? "—"}
                  </td>
                  <td className="max-w-md px-3 py-2 text-white/65">
                    <pre className="whitespace-pre-wrap break-all font-mono text-[10px] leading-snug">
                      {e.meta ? JSON.stringify(e.meta, null, 0) : "—"}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
