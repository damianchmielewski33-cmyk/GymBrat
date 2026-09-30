"use client";

import { useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";

/**
 * Gdy konto zniknie z bazy (czyszczenie DB / usunięcie użytkownika),
 * JWT może chwilę zostać w cookie — po utracie sesji wymuszamy wylogowanie.
 */
export function SessionAccountGuard() {
  const { data, status } = useSession();
  const hadUserId = useRef<string | null>(null);

  useEffect(() => {
    const id = data?.user?.id;
    if (status === "authenticated" && typeof id === "string" && id) {
      hadUserId.current = id;
      return;
    }
    if (status === "unauthenticated" && hadUserId.current) {
      hadUserId.current = null;
      void signOut({ callbackUrl: "/login" });
    }
  }, [data?.user?.id, status]);

  return null;
}
