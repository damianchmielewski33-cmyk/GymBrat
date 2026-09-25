import type { ReactNode } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

/** Ramka ekranów logowania / rejestracji — też dla GET / bez sesji. */
export function AuthPageFrame({ children }: { children: ReactNode }) {
  return (
    <AuthShell>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center">
        {children}
      </div>
    </AuthShell>
  );
}
