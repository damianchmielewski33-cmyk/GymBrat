"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { confirmAccountTakeover } from "@/actions/account-takeover";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthHeroBrand } from "@/components/auth/auth-hero-brand";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineBanner } from "@/components/ui/inline-banner";
import { cn } from "@/lib/utils";

/** Po przejęciu wracamy przez Google; `notice` pokazuje jednorazowy komunikat UX 4B. */
const AFTER_TAKEOVER_REDIRECT = "/register?oauth=1&notice=account_reset";

const TAKEOVER_FAILED_MESSAGE =
  "Nie udało się zabezpieczyć konta. Niczego nie zmieniliśmy. Spróbuj ponownie.";
const TAKEOVER_OFFLINE_MESSAGE =
  "Brak połączenia z internetem. Niczego nie zmieniliśmy. Spróbuj ponownie, gdy wrócisz do sieci.";

/**
 * Ekran „Ten adres ma już konto” (UX 001, 4A): potwierdzenie przejęcia konta
 * założonego bez potwierdzenia adresu. `token === null` = link wygasł lub był użyty.
 */
export function AccountTakeoverScreen({ token }: { token: string | null }) {
  const [expired, setExpired] = useState(token === null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    if (!token || pending) return;
    setError(null);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError(TAKEOVER_OFFLINE_MESSAGE);
      return;
    }
    setPending(true);
    try {
      const res = await confirmAccountTakeover({ token });
      if (!res.ok) {
        if (res.code === "expired") setExpired(true);
        else setError(TAKEOVER_FAILED_MESSAGE);
        setPending(false);
        return;
      }
      // Przekierowanie do Google — `pending` zostaje do opuszczenia strony.
      await signIn("google", { redirectTo: AFTER_TAKEOVER_REDIRECT });
    } catch {
      setError(
        typeof navigator !== "undefined" && navigator.onLine === false
          ? TAKEOVER_OFFLINE_MESSAGE
          : TAKEOVER_FAILED_MESSAGE,
      );
      setPending(false);
    }
  }

  return (
    <div>
      <AuthHeroBrand
        compact
        headline="Ten adres ma już konto"
        support="Zostało założone bez potwierdzenia adresu e-mail."
      />
      <AuthCard bodyClassName="space-y-5">
        {expired ? (
          <>
            <InlineBanner role="alert" variant="error">
              Ten link wygasł. Zaloguj się ponownie przez Google.
            </InlineBanner>
            <Link href="/login" className={cn(buttonVariants({ variant: "cta" }), "w-full")}>
              Przejdź do logowania
            </Link>
          </>
        ) : (
          <>
            {error ? (
              <InlineBanner role="alert" variant="error">
                {error}
              </InlineBanner>
            ) : null}
            <InlineBanner role="status" variant="warning">
              <span className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  Jeśli kontynuujesz przez Google, zabezpieczymy adres: dotychczasowe
                  hasło i wszystkie dane tego konta zostaną trwale usunięte. Tego nie
                  da się cofnąć.
                </span>
              </span>
            </InlineBanner>
            <p className="text-sm text-white/75">
              To Twoje konto i pamiętasz hasło? Zaloguj się hasłem, a dane zostaną.
            </p>
            <div className="space-y-3">
              <Link
                href="/login"
                autoFocus
                className={cn(buttonVariants({ variant: "outline" }), "h-12 w-full")}
              >
                Zaloguj się hasłem
              </Link>
              <Button
                type="button"
                variant="destructive"
                className="h-12 w-full"
                disabled={pending}
                aria-busy={pending}
                onClick={() => void onConfirm()}
              >
                {pending ? "Zabezpieczanie konta…" : "Usuń dane i kontynuuj"}
              </Button>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "link" }), "min-h-12 w-full")}
              >
                Anuluj
              </Link>
            </div>
          </>
        )}
      </AuthCard>
    </div>
  );
}
