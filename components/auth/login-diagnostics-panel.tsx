"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useInstalledAndroidAppIdentity } from "@/hooks/use-android-app-identity";
import {
  isInstalledAndroidAppClient,
  isRunningInAppWebView,
} from "@/lib/app-webview";
import { CSRF_COOKIE_NAME } from "@/lib/csrf-constants";

const MAX_LOG_LINES = 40;

export type LoginDiagEvent = {
  at: string;
  level: "info" | "warn" | "error";
  message: string;
};

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return String(Date.now());
  }
}

function readCookieNames(): string[] {
  if (typeof document === "undefined") return [];
  try {
    return document.cookie
      .split(";")
      .map((p) => p.trim().split("=")[0] ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

function hasSessionCookie(names: string[]): boolean {
  return names.some(
    (n) =>
      n === "authjs.session-token" ||
      n === "__Secure-authjs.session-token" ||
      n === "next-auth.session-token" ||
      n === "__Secure-next-auth.session-token",
  );
}

function summarizeUnknown(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

type Props = {
  /** Ostatnie zdarzenia z LoginForm (próby logowania). */
  events?: LoginDiagEvent[];
};

/**
 * Panel diagnostyczny na ekranie logowania — pomaga w Android WebView
 * zobaczyć UA, cookies, most JS i ostatnie błędy frontowe bez DevTools.
 */
export function LoginDiagnosticsPanel({ events = [] }: Props) {
  const params = useSearchParams();
  const androidId = useInstalledAndroidAppIdentity();
  const forceOpen = params.get("diag") === "1" || params.get("debug") === "1";
  const [open, setOpen] = useState(forceOpen);
  const [copied, setCopied] = useState(false);
  const [runtimeLogs, setRuntimeLogs] = useState<LoginDiagEvent[]>([]);
  const [env, setEnv] = useState({
    href: "",
    origin: "",
    ua: "",
    online: true,
    cookieNames: [] as string[],
    hasSession: false,
    hasCsrf: false,
    inWebViewUa: false,
    hasGymBratBridge: false,
    hasAwpBridge: false,
  });

  useEffect(() => {
    if (forceOpen || androidId || isInstalledAndroidAppClient()) setOpen(true);
  }, [forceOpen, androidId]);

  useEffect(() => {
    function refreshEnv() {
      const cookieNames = readCookieNames();
      setEnv({
        href: window.location.href,
        origin: window.location.origin,
        ua: navigator.userAgent,
        online: navigator.onLine,
        cookieNames,
        hasSession: hasSessionCookie(cookieNames),
        hasCsrf: cookieNames.includes(CSRF_COOKIE_NAME),
        inWebViewUa: isRunningInAppWebView(),
        hasGymBratBridge: Boolean(window.GymBratAndroid),
        hasAwpBridge: Boolean(window.AwpAndroid),
      });
    }
    refreshEnv();
    const onOnline = () => refreshEnv();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOnline);
    const id = window.setInterval(refreshEnv, 2500);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const push = (level: LoginDiagEvent["level"], message: string) => {
      setRuntimeLogs((prev) => {
        const next = [...prev, { at: nowIso(), level, message }];
        return next.slice(-MAX_LOG_LINES);
      });
    };

    const onError = (ev: ErrorEvent) => {
      push(
        "error",
        `window.error: ${ev.message || "(brak)"} @ ${ev.filename || "?"}:${ev.lineno || 0}`,
      );
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      push("error", `unhandledrejection: ${summarizeUnknown(ev.reason)}`);
    };

    const originalError = console.error;
    const originalWarn = console.warn;
    console.error = (...args: unknown[]) => {
      try {
        push("error", `console.error: ${args.map(summarizeUnknown).join(" ")}`);
      } catch {
        /* ignore */
      }
      originalError(...args);
    };
    console.warn = (...args: unknown[]) => {
      try {
        push("warn", `console.warn: ${args.map(summarizeUnknown).join(" ")}`);
      } catch {
        /* ignore */
      }
      originalWarn(...args);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    push("info", "Diagnostyka logowania aktywna");

    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  const allLogs = useMemo(() => {
    return [...runtimeLogs, ...events].sort((a, b) => a.at.localeCompare(b.at)).slice(-MAX_LOG_LINES);
  }, [runtimeLogs, events]);

  const reportText = useMemo(() => {
    const lines = [
      "GymBrat — diagnostyka logowania",
      `czas: ${nowIso()}`,
      `href: ${env.href}`,
      `origin: ${env.origin}`,
      `online: ${env.online}`,
      `ua: ${env.ua}`,
      `webviewUa: ${env.inWebViewUa}`,
      `bridge GymBratAndroid: ${env.hasGymBratBridge}`,
      `bridge AwpAndroid: ${env.hasAwpBridge}`,
      `apk: ${androidId ? `${androidId.versionName} (code ${androidId.versionCode ?? "?"})` : "brak"}`,
      `cookies: ${env.cookieNames.join(", ") || "(brak)"}`,
      `sessionCookie: ${env.hasSession}`,
      `csrfCookie: ${env.hasCsrf}`,
      "",
      "--- logi ---",
      ...allLogs.map((l) => `[${l.at}] ${l.level.toUpperCase()} ${l.message}`),
    ];
    return lines.join("\n");
  }, [env, androidId, allLogs]);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-black/35 p-3 text-left">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="text-left text-xs font-medium uppercase tracking-[0.16em] text-white/55"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          Diagnostyka {open ? "▾" : "▸"}
        </button>
        {open ? (
          <Button type="button" variant="outline" size="sm" onClick={() => void copyReport()}>
            {copied ? "Skopiowano" : "Kopiuj logi"}
          </Button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          <dl className="grid grid-cols-1 gap-1.5 text-[11px] leading-snug text-white/70 sm:grid-cols-2">
            <div>
              <dt className="text-white/40">APK</dt>
              <dd>
                {androidId
                  ? `${androidId.versionName} (code ${androidId.versionCode ?? "—"})`
                  : env.inWebViewUa
                    ? "WebView bez mostu JS"
                    : "przeglądarka / PWA"}
              </dd>
            </div>
            <div>
              <dt className="text-white/40">Sieć</dt>
              <dd>{env.online ? "online" : "offline"}</dd>
            </div>
            <div>
              <dt className="text-white/40">Sesja cookie</dt>
              <dd>{env.hasSession ? "tak" : "nie"}</dd>
            </div>
            <div>
              <dt className="text-white/40">CSRF cookie</dt>
              <dd>{env.hasCsrf ? "tak" : "nie"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-white/40">URL</dt>
              <dd className="break-all">{env.href || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-white/40">User-Agent</dt>
              <dd className="break-all">{env.ua || "—"}</dd>
            </div>
          </dl>

          <div>
            <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-white/40">
              Logi frontowe ({allLogs.length})
            </p>
            <pre className="max-h-48 overflow-auto rounded-lg border border-white/10 bg-black/50 p-2 font-mono text-[10px] leading-relaxed text-white/75 whitespace-pre-wrap break-words">
              {allLogs.length === 0
                ? "Brak zdarzeń — spróbuj się zalogować, błędy pojawią się tutaj."
                : allLogs
                    .map((l) => `[${l.at.slice(11, 19)}] ${l.level}: ${l.message}`)
                    .join("\n")}
            </pre>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-[11px] text-white/40">
          Otwórz, żeby zobaczyć logi frontowe (Android / błąd logowania).
        </p>
      )}
    </div>
  );
}
