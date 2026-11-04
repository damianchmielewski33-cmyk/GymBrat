/** Statusy, z których panel pokazuje „Zaksięguj” (lustro `BOOKABLE_STATUSES` z lib/order-admin, bez importu server-only). */
export const BOOKABLE_CLIENT_STATUSES = ["pending", "amount_mismatch", "cancelled", "failed", "expired"] as const;
