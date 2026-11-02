/** Wspólne (serwer + klient) etykiety i formatowanie zamówień (Z20). */

export type OrderStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "manual"
  | "amount_mismatch";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Oczekuje na płatność",
  paid: "Opłacone",
  failed: "Płatność nieudana",
  cancelled: "Anulowane",
  manual: "Przyznane ręcznie",
  amount_mismatch: "W weryfikacji",
};

export function orderStatusLabel(status: string): string {
  return STATUS_LABELS[status as OrderStatus] ?? status;
}

/** Klient widzi komunikat bez wewnętrznych szczegółów (np. niezgodność kwoty). */
export function orderStatusHint(status: string): string | null {
  switch (status) {
    case "pending":
      return "Czekamy na potwierdzenie płatności z banku — zwykle trwa to kilka sekund.";
    case "paid":
      return "Pakiet jest aktywny.";
    case "failed":
      return "Płatność nie powiodła się. Możesz spróbować ponownie.";
    case "amount_mismatch":
      return "Płatność wymaga ręcznej weryfikacji. Skontaktujemy się z Tobą — nie musisz płacić ponownie.";
    default:
      return null;
  }
}

/** Stany końcowe — dalsze odpytywanie nie ma sensu. */
export function isFinalOrderStatus(status: string): boolean {
  return status !== "pending";
}

export function formatPln(grosze: number): string {
  return `${(Math.max(0, Math.round(grosze)) / 100).toFixed(2).replace(".", ",")} zł`;
}

export function formatOrderDate(value: Date | number | string | null | undefined): string {
  if (value == null) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  });
}
