"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { AdminCard, AdminLoading, AdminPageHeader } from "@/components/admin/admin-ui";
import { PaymentAlertsWidget, type PaymentAlertsData } from "@/components/admin/payment-alerts-widget";
import { adminRequest } from "@/lib/admin-client";
import type { RevenueBucket } from "@/lib/finance";
import { formatPln } from "@/lib/orders-format";

type Data = {
  daily: RevenueBucket[];
  monthly: RevenueBucket[];
  activePackages: number;
  conversion30d: { created: number; paid: number; rate: number | null };
  alerts: PaymentAlertsData;
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[11px] uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-white/50">{hint}</p> : null}
    </div>
  );
}

function Table({ rows, label }: { rows: RevenueBucket[]; label: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[12px] text-white/80">
        <thead className="text-white/50">
          <tr>
            <th className="py-1 pr-3">{label}</th>
            <th className="py-1 pr-3">Opłacone</th>
            <th className="py-1 pr-3">Ręczne</th>
            <th className="py-1">Zwroty</th>
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((r) => (
            <tr key={r.key} className="border-t border-white/5">
              <td className="py-1 pr-3">{r.key}</td>
              <td className="py-1 pr-3">{formatPln(r.paidGrosze)} ({r.paidCount})</td>
              <td className="py-1 pr-3">{formatPln(r.manualGrosze)} ({r.manualCount})</td>
              <td className="py-1">{formatPln(r.refundedGrosze)} ({r.refundedCount})</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminFinanceClient() {
  const { notifyError } = useSaveFeedback();
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await adminRequest<Data>("/api/admin/finance", { fallbackError: "Nie udało się pobrać danych." });
      if (!res.ok) return notifyError(res.error);
      setData(res.data);
    })();
  }, [notifyError]);

  if (!data) return <AdminLoading />;
  const sum = (rows: RevenueBucket[]) => rows.reduce((a, r) => a + r.paidGrosze, 0);
  const thisMonth = data.monthly[data.monthly.length - 1];
  const today = data.daily[data.daily.length - 1];
  const rate = data.conversion30d.rate;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        icon={<Wallet />}
        title="Finanse"
        description="Przychód = zamówienia opłacone przez HotPay. Księgowane ręcznie i zwroty pokazane osobno."
      />
      <PaymentAlertsWidget alerts={data.alerts} linkToOrders />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Dziś" value={formatPln(today?.paidGrosze ?? 0)} />
        <Stat label="Ten miesiąc" value={formatPln(thisMonth?.paidGrosze ?? 0)} hint={`ręcznie: ${formatPln(thisMonth?.manualGrosze ?? 0)}`} />
        <Stat label="Ostatnie 30 dni" value={formatPln(sum(data.daily))} />
        <Stat label="Aktywne pakiety" value={String(data.activePackages)} />
      </div>
      <Stat
        label="Konwersja (30 dni)"
        value={rate == null ? "—" : `${(rate * 100).toFixed(1).replace(".", ",")}%`}
        hint={`${data.conversion30d.paid} opłaconych z ${data.conversion30d.created} utworzonych zamówień`}
      />
      <AdminCard title="Przychód dzienny (30 dni)">
        <Table rows={data.daily} label="Dzień" />
      </AdminCard>
      <AdminCard title="Przychód miesięczny (12 miesięcy)">
        <Table rows={data.monthly} label="Miesiąc" />
      </AdminCard>
    </div>
  );
}
