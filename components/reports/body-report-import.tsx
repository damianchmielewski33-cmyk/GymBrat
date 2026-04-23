"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";

export function BodyReportImport() {
  const router = useRouter();
  const { notifySaved } = useSaveFeedback();
  const [pending, start] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  return (
    <div className="glass-panel neon-glow overflow-hidden">
      {!isOpen ? (
        <div className="flex flex-col gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
              Import historii
            </p>
            <p className="mt-1 text-sm text-white/65">
              Wgraj plik Excel (.xlsx) z poprzednimi raportami, żeby dodać je do historii.
            </p>
          </div>
          <Button
            type="button"
            className="h-11 bg-white/10 text-base font-semibold text-white hover:bg-white/15"
            onClick={() => setIsOpen(true)}
          >
            Importuj z Excela
          </Button>
        </div>
      ) : (
        <div className="border-b border-white/10 px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
                Import historii
              </p>
              <h2 className="font-heading mt-1 text-lg font-semibold text-white">
                Przenieś raporty z Excela
              </h2>
              <p className="mt-1 text-xs text-white/55">
                Arkusz powinien mieć nazwę <span className="font-semibold text-white/70">Raport</span>.
                Import tworzy osobne wpisy w historii wg dat z pliku.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-10 justify-start text-white/75 hover:bg-white/10 hover:text-white sm:justify-center"
              onClick={() => setIsOpen(false)}
            >
              Zamknij
            </Button>
          </div>
        </div>
      )}

      <form
        className={isOpen ? "space-y-5 p-6" : "hidden"}
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setWarnings([]);
          start(async () => {
            try {
              const fd = new FormData();
              if (file) fd.set("file", file);
              if (url.trim()) fd.set("url", url.trim());

              await ensureCsrfCookie();
              const res = await fetch("/api/body-reports/import", {
                method: "POST",
                credentials: "include",
                headers: { ...getXsrfHeaders() },
                body: fd,
              });
              const json = (await res.json()) as
                | { ok: true; imported: number; skipped: number; warnings?: string[] }
                | { ok: false; error: string; warnings?: string[] };

              if (!json.ok) {
                setError(json.error || "Nie udało się zaimportować raportów.");
                setWarnings(json.warnings ?? []);
                return;
              }

              setWarnings(json.warnings ?? []);
              notifySaved(
                `Zaimportowano wpisy: ${json.imported}. Pominięto: ${json.skipped}.`,
              );
              setFile(null);
              setUrl("");
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Nieznany błąd");
            }
          });
        }}
      >
        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        {warnings.length ? (
          <div className="rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-yellow-100/80">
              Uwagi importu
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-yellow-100/90">
              {warnings.map((w, i) => (
                <li key={`${i}-${w}`}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="xlsxFile">Plik Excel (.xlsx)</Label>
            <Input
              id="xlsxFile"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={pending}
              className="h-10 border-white/15 bg-black/40 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white/80 hover:file:bg-white/15"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
              }}
            />
            <p className="text-xs text-white/45">
              Jeśli masz plik lokalnie (np. <span className="font-mono">C:\Users\...\plik.xlsx</span>) — wybierz go tutaj.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="xlsxUrl">Link do pliku Excel</Label>
            <Input
              id="xlsxUrl"
              inputMode="url"
              value={url}
              disabled={pending}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://.../raport.xlsx"
              className="h-10 border-white/15 bg-black/40"
            />
            <p className="text-xs text-white/45">Link musi być publiczny i zaczynać się od http(s).</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="submit"
            disabled={pending || (!file && !url.trim())}
            className="h-11 bg-[var(--neon)] text-base font-semibold text-white hover:bg-[#ff4d6d]"
          >
            {pending ? "Importuję…" : "Importuj raporty"}
          </Button>
        </div>
      </form>
    </div>
  );
}

