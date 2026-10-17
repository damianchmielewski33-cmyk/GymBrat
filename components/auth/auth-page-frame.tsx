import type { ReactNode } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { WebViewViewportLock } from "@/components/auth/webview-viewport-lock";

/** Ramka ekranów logowania / rejestracji — też dla GET / bez sesji. */
export function AuthPageFrame({ children }: { children: ReactNode }) {
  return (
    <AuthShell>
      <WebViewViewportLock />
      {/* justify-start: centrowanie w flex-1 na iOS skakało przy zmianie paska URL / ładowaniu galerii */}
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-start pt-2 sm:justify-center sm:pt-0">
        {children}
      </div>
    </AuthShell>
  );
}
