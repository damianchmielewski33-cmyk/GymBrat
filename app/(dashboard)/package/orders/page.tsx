import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/layout/screen";
import { listUserOrders } from "@/lib/orders";
import {
  formatOrderDate,
  formatPln,
  orderStatusHint,
  orderStatusLabel,
} from "@/lib/orders-format";

export const metadata = { title: "Zamówienia" };

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/package/orders");
  const orders = await listUserOrders(session.user.id);

  return (
    <div className="space-y-4">
      <AppPageHeader
        backHref="/package"
        backLabel="Pakiet"
        kicker="Pakiet"
        title="Moje zamówienia"
        description="Historia zakupów i potwierdzenia zakupu."
      />
      {orders.length === 0 ? (
        <p className="app-card p-5 text-sm text-white/60">
          Nie masz jeszcze zamówień.{" "}
          <Link href="/package" className="text-[var(--gym-gold)] underline">
            Zobacz pakiety
          </Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const hint = orderStatusHint(o.status);
            return (
              <li key={o.id} className="app-card space-y-1.5 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-white">
                    {o.planSku} · {o.days} dni
                  </span>
                  <span className="text-sm text-white/85">{formatPln(o.amountGrosze)}</span>
                </div>
                <p className="text-[12px] text-white/55">
                  {formatOrderDate(o.paidAt ?? o.createdAt)} · {orderStatusLabel(o.status)}
                  {o.receiptNumber ? ` · ${o.receiptNumber}` : ""}
                </p>
                {hint && o.status !== "paid" ? (
                  <p className="text-[12px] text-white/60">{hint}</p>
                ) : null}
                {o.status === "paid" ? (
                  <Link
                    href={`/package/receipt/${encodeURIComponent(o.id)}`}
                    className="inline-block text-[13px] text-[var(--gym-gold)] underline"
                  >
                    {o.receiptNumber ? "Potwierdzenie zakupu" : "Wystaw potwierdzenie zakupu"}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
