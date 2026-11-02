import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { AppPageHeader } from "@/components/layout/screen";
import { PrintButton } from "@/components/package/print-button";
import { ReceiptForm } from "@/components/package/receipt-form";
import { getUserOrder } from "@/lib/orders";
import { formatOrderDate, formatPln } from "@/lib/orders-format";
import { getIssuedReceipt } from "@/lib/receipts";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/package/receipt/${encodeURIComponent(id)}`);

  const order = await getUserOrder(session.user.id, id);
  if (!order || order.status !== "paid") notFound();
  const receipt = await getIssuedReceipt(session.user.id, id);

  return (
    <div className="space-y-4">
      <AppPageHeader kicker="Pakiet" title="Potwierdzenie zakupu" />
      {!receipt ? (
        <ReceiptForm orderId={id} />
      ) : (
        <>
          <article className="app-card space-y-3 p-5 text-sm text-white/85 print:text-black">
            <p className="text-lg font-semibold">Potwierdzenie zakupu nr {receipt.number}</p>
            <p>Data wystawienia: {formatOrderDate(receipt.issuedAt)}</p>
            <p>Data zapłaty: {formatOrderDate(receipt.paidAt)}</p>
            <p>Sprzedawca: wg danych w Regulaminie (do uzupełnienia przez właściciela).</p>
            {receipt.buyerName ? (
              <p>
                Nabywca: {receipt.buyerName}
                {receipt.buyerTaxId ? `, NIP ${receipt.buyerTaxId}` : ""}
              </p>
            ) : null}
            <p>
              Usługa: dostęp do pakietu GymBrat ({receipt.planSku}), {receipt.days} dni
            </p>
            <p className="font-medium">Kwota zapłacona: {formatPln(receipt.amountGrosze)}</p>
            <p className="text-[12px] text-white/50 print:text-black/60">
              Dokument potwierdza dokonanie zakupu; sprzedawca nie jest czynnym podatnikiem VAT i nie
              wystawia faktur VAT (DK-1).
            </p>
          </article>
          <PrintButton />
        </>
      )}
    </div>
  );
}
