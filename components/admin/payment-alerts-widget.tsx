"use client";

import Link from "next/link";
import { AdminNotice } from "@/components/admin/admin-ui";

export type PaymentAlertsData = {
  pendingStale: number;
  paidUnfulfilled: number;
  amountMismatch: number;
  latePayments: number;
  total: number;
};

/** Z23: widżet alertów płatności; nic nie pokazuje, gdy wszystko w porządku. */
export function PaymentAlertsWidget({ alerts, linkToOrders }: { alerts: PaymentAlertsData | null; linkToOrders?: boolean }) {
  if (!alerts || alerts.total === 0) return null;
  const items: string[] = [];
  if (alerts.paidUnfulfilled) items.push(`opłacone bez przyznanego pakietu: ${alerts.paidUnfulfilled}`);
  if (alerts.latePayments) items.push(`płatność dla anulowanego/wygasłego zamówienia: ${alerts.latePayments}`);
  if (alerts.amountMismatch) items.push(`niezgodna kwota: ${alerts.amountMismatch}`);
  if (alerts.pendingStale) items.push(`oczekujące dłużej niż 1 h: ${alerts.pendingStale}`);
  return (
    <AdminNotice
      tone="danger"
      action={
        linkToOrders ? (
          <Link href="/admin/orders" className="text-[12px] font-semibold underline">
            Zamówienia
          </Link>
        ) : undefined
      }
    >
      <strong>Płatności wymagają uwagi.</strong> {items.join(" · ")}
    </AdminNotice>
  );
}
