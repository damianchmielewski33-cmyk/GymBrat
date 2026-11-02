"use client";

import { useCallback, useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { AdminCard, AdminEmpty, AdminLoading, AdminPageHeader, AdminPill, type AdminTone } from "@/components/admin/admin-ui";
import { PaymentAlertsWidget, type PaymentAlertsData } from "@/components/admin/payment-alerts-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminRequest } from "@/lib/admin-client";
import { BOOKABLE_CLIENT_STATUSES } from "@/lib/orders-admin-client";
import { formatOrderDate, formatPln, orderStatusLabel } from "@/lib/orders-format";

type Row = {
  id: string;
  planSku: string;
  days: number;
  amountGrosze: number;
  status: string;
  createdAt: string | number;
  paidAt: string | number | null;
  fulfilledAt: string | number | null;
  latePaymentAt: string | number | null;
  hotpayPaymentId: string | null;
  adminNote: string | null;
  userEmail: string | null;
};

const FILTERS = ["", "pending", "paid", "amount_mismatch", "manual", "cancelled", "expired", "failed", "refunded"] as const;

function tone(status: string): AdminTone {
  if (status === "paid" || status === "manual") return "ok";
  if (status === "amount_mismatch" || status === "failed") return "danger";
  if (status === "pending") return "warn";
  return "neutral";
}

export function AdminOrdersClient() {
  const { notifyError, notifySaved } = useSaveFeedback();
  const [status, setStatus] = useState<string>("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [alerts, setAlerts] = useState<PaymentAlertsData | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await adminRequest<{ orders?: Row[]; alerts?: PaymentAlertsData }>(
      `/api/admin/orders${status ? `?status=${status}` : ""}`,
      { fallbackError: "Nie udało się pobrać zamówień." },
    );
    if (!res.ok) {
      notifyError(res.error);
      setRows([]);
      return;
    }
    setRows(res.data.orders ?? []);
    setAlerts(res.data.alerts ?? null);
  }, [status, notifyError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: "book" | "cancel" | "refund") {
    const res = await adminRequest(`/api/admin/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { action, note: notes[id] || undefined },
      fallbackError: "Nie udało się wykonać akcji.",
    });
    if (!res.ok) return notifyError(res.error);
    notifySaved("Zapisano.");
    setNotes((n) => ({ ...n, [id]: "" }));
    void load();
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        icon={<Receipt />}
        title="Zamówienia"
        description="Płatności za pakiety: filtr statusu, ręczne księgowanie, anulowanie i odnotowanie zwrotu."
      />
      <PaymentAlertsWidget alerts={alerts} />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((s) => (
          <Button key={s || "all"} type="button" size="sm" variant={s === status ? "default" : "outline"} onClick={() => { setRows(null); setStatus(s); }}>
            {s ? orderStatusLabel(s) : "Wszystkie"}
          </Button>
        ))}
      </div>
      {rows === null ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty title="Brak zamówień w tym widoku." />
      ) : (
        rows.map((o) => {
          const canBook = o.userEmail != null && (BOOKABLE_CLIENT_STATUSES as readonly string[]).includes(o.status);
          const canCancel = o.status === "pending";
          const canRefund =
            ["paid", "manual", "amount_mismatch"].includes(o.status) ||
            (o.latePaymentAt != null && ["pending", "cancelled", "failed", "expired"].includes(o.status));
          return (
            <AdminCard key={o.id}>
              <div className="flex flex-wrap items-center gap-2">
                <AdminPill tone={tone(o.status)}>{orderStatusLabel(o.status)}</AdminPill>
                {o.latePaymentAt ? <AdminPill tone="danger">płatność po terminie</AdminPill> : null}
                {o.status === "paid" && !o.fulfilledAt ? <AdminPill tone="danger">bez pakietu</AdminPill> : null}
                <span className="text-sm font-medium text-white">
                  {o.planSku} · {o.days} dni · {formatPln(o.amountGrosze)}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-white/55">
                {o.userEmail ?? "konto usunięte"} · utworzone {formatOrderDate(o.createdAt)}
                {o.paidAt ? ` · opłacone ${formatOrderDate(o.paidAt)}` : ""} · {o.id.slice(0, 8)}
                {o.hotpayPaymentId ? ` · HotPay ${o.hotpayPaymentId}` : ""}
              </p>
              {o.adminNote ? <p className="mt-2 whitespace-pre-wrap text-[12px] text-white/70">{o.adminNote}</p> : null}
              {canBook || canCancel || canRefund ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Input
                    className="max-w-xs"
                    placeholder="Notatka (przy zwrocie wymagana)"
                    maxLength={500}
                    value={notes[o.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [o.id]: e.target.value }))}
                  />
                  {canBook ? (
                    <Button type="button" size="sm" onClick={() => void act(o.id, "book")}>
                      Zaksięguj (nadaj pakiet)
                    </Button>
                  ) : null}
                  {canCancel ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => void act(o.id, "cancel")}>
                      Anuluj
                    </Button>
                  ) : null}
                  {canRefund ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => void act(o.id, "refund")}>
                      Odnotuj zwrot
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </AdminCard>
          );
        })
      )}
    </div>
  );
}
