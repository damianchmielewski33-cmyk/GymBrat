"use client";

import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { signIn, signOut } from "next-auth/react";
import {
  AppDialog,
  AppDialogActions,
  AppDialogButton,
} from "@/components/ui/app-dialog";
import { Input } from "@/components/ui/input";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";

const DELETE_PHRASE = "USUŃ";

async function downloadExport(format: "json" | "csv") {
  const res = await fetch(`/api/user/export?format=${format}`, {
    credentials: "include",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || "Nie udało się pobrać eksportu.");
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/i.exec(cd);
  const filename =
    match?.[1] ?? (format === "csv" ? "gymbrat-export.csv" : "gymbrat-export.json");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Eksport danych (RODO) — dwa przyciski JSON / CSV. */
export function DataExportActions() {
  const [busy, setBusy] = useState<"json" | "csv" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onExport(format: "json" | "csv") {
    setError(null);
    setBusy(format);
    try {
      await downloadExport(format);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eksport nie powiódł się.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {(["json", "csv"] as const).map((format) => (
          <button
            key={format}
            type="button"
            disabled={busy != null}
            onClick={() => void onExport(format)}
            className="gym-btn-secondary inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            {busy === format ? "Pobieranie…" : `Eksport ${format.toUpperCase()}`}
          </button>
        ))}
      </div>
      {error ? (
        <p className="text-[13px] text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const PROVIDER_LABEL: Record<string, string> = { google: "Google", facebook: "Facebook" };

/**
 * Usunięcie konta: fraza + ponowne uwierzytelnienie (Z14) — hasło albo świeże logowanie
 * dostawcą OAuth (po powrocie z logowania okno otwiera się samo: `autoOpen`).
 */
export function DeleteAccountControl({
  oauthProviders = [],
  autoOpen = false,
}: {
  oauthProviders?: string[];
  autoOpen?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(autoOpen);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [needsReauth, setNeedsReauth] = useState(false);
  const provider = oauthProviders.find((p) => p in PROVIDER_LABEL) ?? null;
  const confirmed = confirmText.trim().toUpperCase() === DELETE_PHRASE;

  async function onDelete() {
    if (!confirmed) return;
    setError(null);
    setBusy(true);
    try {
      await ensureCsrfCookie();
      const res = await fetch("/api/user/account", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getXsrfHeaders() },
        body: JSON.stringify({
          confirm: confirmText.trim(),
          ...(password ? { password } : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        code?: string;
      } | null;
      if (!res.ok) {
        if (data?.code === "REAUTH_REQUIRED") setNeedsReauth(true);
        throw new Error(data?.error || "Nie udało się usunąć konta.");
      }
      setOpen(false);
      await signOut({ callbackUrl: "/login" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Usuwanie nie powiodło się.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setConfirmText("");
          setPassword("");
          setNeedsReauth(false);
          setError(null);
          setOpen(true);
        }}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-400/35 bg-rose-400/10 px-4 text-sm font-semibold text-rose-200 transition-colors hover:bg-rose-400/20 disabled:opacity-50 sm:w-auto"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Usuń konto
      </button>
      {error && !open ? (
        <p className="text-[13px] text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      <AppDialog
        open={open}
        onOpenChange={setOpen}
        tone="danger"
        icon={Trash2}
        title="Usunąć konto na zawsze?"
        description={
          <>
            Skasujemy konto i powiązane z nim dane. Tego nie da się cofnąć. Wpisz{" "}
            <span className="font-semibold text-white">{DELETE_PHRASE}</span>, żeby potwierdzić.
          </>
        }
      >
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Hasło do konta"
            autoComplete="current-password"
            aria-label="Hasło do konta"
            className="mt-4 focus-visible:border-rose-400/50"
          />
          {provider ? (
            <p className="mt-2 text-[12px] leading-snug text-white/50">
              Logujesz się przez {PROVIDER_LABEL[provider]}? Zamiast hasła możesz{" "}
              <button
                type="button"
                className="underline"
                onClick={() =>
                  void signIn(
                    provider,
                    { redirectTo: "/profile/account?delete=1" },
                    { prompt: "login", auth_type: "reauthenticate" },
                  )
                }
              >
                zalogować się ponownie
              </button>{" "}
              — okno usuwania otworzy się po powrocie.
            </p>
          ) : null}
          {needsReauth && !provider ? (
            <p className="mt-2 text-[12px] text-amber-200/80">Podaj hasło, aby potwierdzić tożsamość.</p>
          ) : null}
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={DELETE_PHRASE}
            autoComplete="off"
            aria-label={`Wpisz ${DELETE_PHRASE}, aby potwierdzić`}
            className="mt-4 focus-visible:border-rose-400/50"
          />
          {error ? (
            <p className="mt-2 text-[13px] text-rose-300" role="alert">
              {error}
            </p>
          ) : null}
          <AppDialogActions className="mt-5">
            <AppDialogButton
              intent="danger"
              disabled={busy || !confirmed}
              onClick={() => void onDelete()}
            >
              {busy ? "Usuwanie…" : "Usuń konto na zawsze"}
            </AppDialogButton>
            <AppDialogButton disabled={busy} onClick={() => setOpen(false)}>
              Anuluj
            </AppDialogButton>
          </AppDialogActions>
      </AppDialog>
    </div>
  );
}
