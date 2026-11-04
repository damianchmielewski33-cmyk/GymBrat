"use client";

import { useCallback, useEffect, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { AdminCard, AdminEmpty, AdminLoading, AdminPageHeader, AdminPill } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { adminRequest } from "@/lib/admin-client";
import {
  SUPPORT_KIND_LABELS,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
  supportDueLabel,
  type SupportKind,
  type SupportStatus,
} from "@/lib/support";

type Row = {
  id: string;
  kind: string;
  subject: string;
  message: string;
  orderId: string | null;
  contactEmail: string;
  status: string;
  createdAt: string | number;
  dueAt: string | number;
  adminNote: string | null;
  accountEmail: string;
};

export function AdminSupportClient() {
  const { notifyError, notifySaved } = useSaveFeedback();
  const [status, setStatus] = useState<SupportStatus>("new");
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    const res = await adminRequest<{ requests?: Row[] }>(`/api/admin/support?status=${status}`, {
      fallbackError: "Nie udało się pobrać zgłoszeń.",
    });
    if (!res.ok) {
      notifyError(res.error);
      setRows([]);
      return;
    }
    setRows(res.data.requests ?? []);
  }, [status, notifyError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setRowStatus(id: string, next: SupportStatus) {
    const res = await adminRequest(`/api/admin/support/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { status: next },
      fallbackError: "Nie udało się zmienić statusu.",
    });
    if (!res.ok) return notifyError(res.error);
    notifySaved("Status zapisany.");
    void load();
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader icon={<LifeBuoy />} title="Wsparcie i reklamacje" description="Termin odpowiedzi: 14 dni od zgłoszenia (regulamin §8)." />
      <div className="flex flex-wrap gap-2">
        {SUPPORT_STATUSES.map((s) => (
          <Button key={s} type="button" size="sm" variant={s === status ? "default" : "outline"} onClick={() => setStatus(s)}>
            {SUPPORT_STATUS_LABELS[s]}
          </Button>
        ))}
      </div>
      {rows === null ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty title="Brak zgłoszeń w tym statusie." />
      ) : (
        rows.map((r) => {
          const overdue = r.status !== "resolved" && new Date(r.dueAt).getTime() < Date.now();
          return (
            <AdminCard key={r.id}>
              <div className="flex flex-wrap items-center gap-2">
                <AdminPill tone={overdue ? "danger" : "gold"}>{SUPPORT_KIND_LABELS[r.kind as SupportKind] ?? r.kind}</AdminPill>
                <span className="text-sm font-medium text-white">{r.subject}</span>
              </div>
              <p className="mt-1 text-[12px] text-white/55">
                {r.contactEmail} (konto: {r.accountEmail}) · odpowiedź do {supportDueLabel(new Date(r.dueAt))}
                {overdue ? " — PO TERMINIE" : ""}
                {r.orderId ? ` · zamówienie ${r.orderId.slice(0, 8)}` : ""}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-[13px] text-white/80">{r.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status !== "in_progress" && r.status !== "resolved" ? (
                  <Button type="button" size="sm" onClick={() => void setRowStatus(r.id, "in_progress")}>
                    W toku
                  </Button>
                ) : null}
                {r.status !== "resolved" ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => void setRowStatus(r.id, "resolved")}>
                    Zakończ
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => void setRowStatus(r.id, "new")}>
                    Otwórz ponownie
                  </Button>
                )}
              </div>
            </AdminCard>
          );
        })
      )}
    </div>
  );
}
