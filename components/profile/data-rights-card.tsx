"use client";

import { signOut } from "next-auth/react";
import { useTransition } from "react";
import { Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";

export function DataRightsCard() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [pendingExport, startExport] = useTransition();
  const [pendingCsv, startCsv] = useTransition();
  const [pendingDelete, startDelete] = useTransition();

  function downloadExport() {
    startExport(async () => {
      try {
        const res = await fetch("/api/user/export", { credentials: "include" });
        if (!res.ok) throw new Error("export_failed");
        const data = (await res.json()) as unknown;
        const text = JSON.stringify(data, null, 2);
        const blob = new Blob([text], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `gymbrat-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        notifySaved("Pobrano plik eksportu (JSON).");
      } catch {
        notifyError("Nie udało się wygenerować eksportu.");
      }
    });
  }

  function downloadCsv() {
    startCsv(async () => {
      try {
        const res = await fetch("/api/user/export?format=csv", { credentials: "include" });
        if (!res.ok) throw new Error("export_failed");
        const text = await res.text();
        const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `gymbrat-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        notifySaved("Pobrano eksport CSV.");
      } catch {
        notifyError("Nie udało się wygenerować CSV.");
      }
    });
  }

  function deleteAccount() {
    if (
      !confirm(
        "Na pewno usunąć konto i wszystkie powiązane dane (treningi, raporty, ustawienia)? Operacja jest nieodwracalna.",
      )
    ) {
      return;
    }
    startDelete(async () => {
      try {
        await ensureCsrfCookie();
        const res = await fetch("/api/user/account", {
          method: "DELETE",
          credentials: "include",
          headers: { ...getXsrfHeaders() },
        });
        const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!res.ok || !j?.ok) {
          notifyError(j?.error ?? "Usunięcie konta nie powiodło się.");
          return;
        }
        notifySaved("Konto zostało usunięte.");
        await signOut({ callbackUrl: "/login" });
      } catch {
        notifyError("Usunięcie konta nie powiodło się.");
      }
    });
  }

  return (
    <section className="glass-panel relative overflow-hidden p-8 lg:col-span-2">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(900px_420px_at_50%_100%,rgba(255,45,85,0.12),transparent_60%)]" />
      <div className="relative space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
            Dane osobowe (RODO)
          </p>
          <h2 className="font-heading mt-2 text-xl font-semibold">Eksport i usunięcie konta</h2>
          <p className="mt-2 text-sm text-white/65">
            Możesz pobrać kopię swoich danych w formacie JSON albo trwale usunąć konto wraz z treningami,
            raportami i ustawieniami przechowywanymi w Turso.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={pendingExport || pendingCsv || pendingDelete}
            className="border-white/15 bg-white/[0.06]"
            onClick={() => downloadExport()}
          >
            <Download className="mr-2 h-4 w-4" />
            {pendingExport ? "Generowanie…" : "Pobierz eksport JSON"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pendingExport || pendingCsv || pendingDelete}
            className="border-white/15 bg-white/[0.06]"
            onClick={() => downloadCsv()}
          >
            <Download className="mr-2 h-4 w-4" />
            {pendingCsv ? "Generowanie…" : "Pobierz CSV"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pendingExport || pendingCsv || pendingDelete}
            className="bg-red-600/90 hover:bg-red-600"
            onClick={() => deleteAccount()}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {pendingDelete ? "Usuwanie…" : "Usuń konto"}
          </Button>
        </div>
      </div>
    </section>
  );
}
