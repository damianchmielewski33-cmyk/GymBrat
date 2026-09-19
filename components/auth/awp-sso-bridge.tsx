"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isTrustedAwpOrigin } from "@/lib/awp-origin";

/**
 * Gdy GymBrat otwarty z Akademii (`?from=awp` lub iframe):
 * 1) akceptuje `awp_token` / `awpToken` w URL,
 * 2) prosi parent window o token sesji (postMessage),
 * 3) wymienia token na sesję GymBrat przez `/api/auth/awp-bridge`.
 */
export function AwpSsoBridge() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    const fromAwp = params.get("from") === "awp";
    const urlToken =
      params.get("awp_token")?.trim() || params.get("awpToken")?.trim() || "";
    const inIframe =
      typeof window !== "undefined" && window.parent && window.parent !== window;

    if (!fromAwp && !urlToken && !inIframe) return;
    started.current = true;

    let cancelled = false;

    async function exchange(token: string) {
      setStatus("Logowanie wspólnym kontem Akademii…");
      try {
        const res = await fetch("/api/auth/awp-bridge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, from: "awp" }),
        });
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string }
          | null;
        if (cancelled) return;
        if (!res.ok || !json?.ok) {
          setStatus(null);
          return;
        }
        const callback = params.get("callbackUrl") || "/";
        window.location.assign(callback);
      } catch {
        if (!cancelled) setStatus(null);
      }
    }

    if (urlToken) {
      void exchange(urlToken);
      return () => {
        cancelled = true;
      };
    }

    function onMessage(ev: MessageEvent) {
      if (!isTrustedAwpOrigin(ev.origin)) return;
      const data = ev.data as
        | { type?: string; token?: string; awpToken?: string }
        | null;
      if (!data || typeof data !== "object") return;
      if (data.type !== "awp-session" && data.type !== "gymbrat-awp-sso") return;
      const token = (data.token || data.awpToken || "").trim();
      if (!token) return;
      void exchange(token);
    }

    window.addEventListener("message", onMessage);

    // Poproś shell Akademii o token (jeśli parent nasłuchuje).
    try {
      if (inIframe && window.parent) {
        window.parent.postMessage(
          { type: "gymbrat-request-awp-session" },
          "*",
        );
      }
    } catch {
      /* ignore */
    }

    const t = window.setTimeout(() => {
      if (!cancelled) setStatus(null);
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      window.removeEventListener("message", onMessage);
    };
  }, [params, router]);

  if (!status) return null;

  return (
    <p className="mb-4 rounded-lg border border-[var(--neon)]/25 bg-[var(--neon)]/10 px-3 py-2 text-sm text-white/85">
      {status}
    </p>
  );
}
