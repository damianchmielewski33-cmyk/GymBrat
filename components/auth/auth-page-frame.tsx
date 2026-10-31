import type { ReactNode } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { WebViewViewportLock } from "@/components/auth/webview-viewport-lock";

/**
 * Ramka ekranów logowania / rejestracji — też dla GET / bez sesji.
 * `auth`: bez galerii i szeroka (układ dwukolumnowy logowania); węższe ekrany ograniczają się same.
 */
export function AuthPageFrame({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "auth";
}) {
  const auth = variant === "auth";
  return (
    <AuthShell gallery={!auth}>
      <WebViewViewportLock />
      {/* justify-start: centrowanie w flex-1 na iOS skakało przy zmianie paska URL / ładowaniu galerii */}
      <div
        className={
          auth
            ? "mx-auto flex w-full max-w-5xl flex-1 flex-col justify-start pt-2 sm:justify-center sm:pt-0"
            : "mx-auto flex w-full max-w-xl flex-1 flex-col justify-start pt-2 sm:justify-center sm:pt-0"
        }
      >
        {children}
      </div>
    </AuthShell>
  );
}
