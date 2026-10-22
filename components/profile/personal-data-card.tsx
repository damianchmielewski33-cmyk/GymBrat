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
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { cn } from "@/lib/utils";

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
    match?.[1] ??
    (format === "csv" ? "gymbrat-export.csv" : "gymbrat-export.json");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function PersonalDataCard() {
  const [busy, setBusy] = useState<"json" | "csv" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

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

  async function onDelete() {
    if (confirmText.trim().toUpperCase() !== "USUŃ") return;
    setError(null);
    setBusy("delete");
    try {
      await ensureCsrfCookie();
      const res = await fetch("/api/user/account", {
        method: "DELETE",
        credentials: "include",
        headers: {
          ...getXsrfHeaders(),
        },
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error || "Nie udało się usunąć konta.");
      }
      setDeleteOpen(false);
      await signOut({ callbackUrl: "/login" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Usuwanie nie powiodło się.");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-snug text-white/50">
        Masz prawo do przenoszenia i usunięcia danych (RODO). Eksport obejmuje
        dane konta, treningi, dietę i raporty dostępne w aplikacji.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void onExport("json")}
          className="gym-btn-secondary inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50"
        >
          <Download className="h-4 w-4" aria-hidden />
          {busy === "json" ? "Pobieranie…" : "Eksport JSON"}
        </button>
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void onExport("csv")}
          className="gym-btn-secondary inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50"
        >
          <Download className="h-4 w-4" aria-hidden />
          {busy === "csv" ? "Pobieranie…" : "Eksport CSV"}
        </button>
      </div>

      <div className="rounded-xl border border-rose-400/25 bg-rose-400/5 px-3.5 py-3">
        <p className="text-[13px] font-semibold text-rose-200">Usuń konto</p>
        <p className="mt-1 text-[12px] leading-snug text-white/45">
          Trwale kasuje konto i powiązane dane w GymBrat. Operacja jest
          nieodwracalna.
        </p>
        <button
          type="button"
          disabled={busy != null}
          onClick={() => {
            setConfirmText("");
            setDeleteOpen(true);
          }}
          className={cn(
            "mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-400/35 bg-rose-400/10 px-3 text-[13px] font-semibold text-rose-200 hover:bg-rose-400/20 disabled:opacity-50",
          )}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Usuń konto…
        </button>
      </div>

      {error ? (
        <p className="text-[13px] text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="border border-white/10 bg-[#0c0c0c] p-6">
          <AlertDialogTitle className="text-lg font-semibold text-white">
            Na pewno usunąć konto?
          </AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-[13px] leading-snug text-white/60">
            Wpisz <span className="font-semibold text-white">USUŃ</span>, żeby
            potwierdzić. Tej operacji nie da się cofnąć.
          </AlertDialogDescription>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="USUŃ"
            autoComplete="off"
            className="mt-4 h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white outline-none focus:border-rose-400/50"
          />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="button"
              disabled={
                busy === "delete" || confirmText.trim().toUpperCase() !== "USUŃ"
              }
              onClick={() => void onDelete()}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-rose-400/40 bg-rose-400/15 text-sm font-semibold text-rose-100 disabled:opacity-40"
            >
              {busy === "delete" ? "Usuwanie…" : "Usuń na zawsze"}
            </button>
            <button
              type="button"
              disabled={busy === "delete"}
              onClick={() => setDeleteOpen(false)}
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
