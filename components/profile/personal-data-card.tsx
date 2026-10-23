"use client";

import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

/** Usunięcie konta z potwierdzeniem wpisaniem frazy. */
export function DeleteAccountControl() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
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
        headers: { ...getXsrfHeaders() },
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error || "Nie udało się usunąć konta.");
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

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="border border-white/10 bg-[#0c0c0c] p-6">
          <AlertDialogTitle className="text-lg font-semibold text-white">
            Na pewno usunąć konto?
          </AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-[13px] leading-snug text-white/60">
            Wpisz <span className="font-semibold text-white">{DELETE_PHRASE}</span>, żeby
            potwierdzić. Tej operacji nie da się cofnąć.
          </AlertDialogDescription>
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
          <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="button"
              disabled={busy || !confirmed}
              onClick={() => void onDelete()}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-rose-400/40 bg-rose-400/15 text-sm font-semibold text-rose-100 disabled:opacity-40"
            >
              {busy ? "Usuwanie…" : "Usuń na zawsze"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
              className="gym-btn-secondary h-11 flex-1 rounded-xl text-sm font-semibold"
            >
              Anuluj
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
