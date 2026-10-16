import type { ReactNode } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { WebViewViewportLock } from "@/components/auth/webview-viewport-lock";

/** Ramka ekranów logowania / rejestracji — też dla GET / bez sesji. */
export function AuthPageFrame({ children }: { children: ReactNode }) {
  return (
    <AuthShell>
      <WebViewViewportLock />
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center">
        {children}
      </div>
    </AuthShell>
  );
}
