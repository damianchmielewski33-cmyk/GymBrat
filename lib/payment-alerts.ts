import { AppError } from "@/lib/errors/app-error";
import { logServerError, newRequestId } from "@/lib/errors/server-log";

/**
 * Z23: alert płatności do logów i Sentry z tagiem `area=payments`. Wiadomość zawiera wyłącznie
 * identyfikatory i kwoty (bez danych osobowych). Wysyłany jako 5xx, więc trafia do Sentry.
 */
export function logPaymentAlert(kind: string, message: string, origin = "hotpay.notify"): void {
  logServerError(
    new AppError("INTERNAL", { message }),
    { requestId: newRequestId(), origin, tags: { area: "payments", paymentAlert: kind } },
  );
}
