"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { FilePickerButton } from "@/components/ui/file-picker-button";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { cn } from "@/lib/utils";

export function WorkoutPlanWordImport() {
  const router = useRouter();
  const { notifySaved } = useSaveFeedback();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  return (
    <section
      className={cn(
        "rounded-[22px] border border-white/[0.08] bg-[#141416] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)]",
      )}
    >
      {!open ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
              Import z Worda
            </p>
            <p className="mt-1.5 text-sm text-white/50">
              Wgraj plan treningowy z pliku .docx — aplikacja utworzy dni/plany z
              ćwiczeniami, seriami i powtórzeniami.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10 px-4 text-sm font-semibold text-[var(--gym-gold)] hover:bg-[var(--gym-gold)]/15"
          >
            <FileUp className="h-4 w-4" aria-hidden />
            Importuj z Worda
          </button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setWarnings([]);
            if (!file) {
              setError("Wybierz plik .docx.");
              return;
            }
            start(async () => {
              try {
                await ensureCsrfCookie();
                const fd = new FormData();
                fd.set("file", file);
                const res = await fetch("/api/workout-plans/import", {
                  method: "POST",
                  credentials: "include",
                  headers: { ...getXsrfHeaders() },
                  body: fd,
                });
                const json = (await res.json()) as {
                  ok: boolean;
                  error?: string;
                  imported?: number;
                  warnings?: string[];
                  planNames?: string[];
                };
                if (!json.ok) {
                  setError(json.error ?? "Import nieudany.");
                  setWarnings(json.warnings ?? []);
                  return;
                }
                setWarnings(json.warnings ?? []);
                notifySaved(
                  json.imported === 1
                    ? `Zaimportowano plan „${json.planNames?.[0] ?? "z Worda"}”.`
                    : `Zaimportowano ${json.imported} planów z Worda.`,
                );
                setFile(null);
                setOpen(false);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Nieznany błąd");
              }
            });
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
                Import z Worda
              </p>
              <h3 className="mt-1 text-base font-semibold text-white">
                Utwórz plan z dokumentu
              </h3>
              <p className="mt-1 text-xs text-white/45">
                Najlepiej: nagłówki dni (np. „Dzień A”, „Push”) i linie ćwiczeń z
                seriami, np. „Przysiady 4x8”.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
                setWarnings([]);
              }}
              className="text-sm text-white/50 hover:text-white"
            >
              Zamknij
            </button>
          </div>

          <FilePickerButton
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={pending}
            onFiles={(files) => {
              setFile(files[0] ?? null);
              setError(null);
            }}
            valueLabel={file ? file.name : undefined}
            emptyLabel="Wybierz plik .docx"
          />

          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          {warnings.length > 0 ? (
            <ul className="space-y-1 text-xs text-amber-200/80">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          <button
            type="submit"
            disabled={pending || !file}
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#f0d56a] via-[#d4af37] to-[#b8922a] text-sm font-bold text-[#0a0906] disabled:opacity-45 sm:w-auto sm:px-6"
          >
            {pending ? "Importowanie…" : "Utwórz plany z Worda"}
          </button>
        </form>
      )}
    </section>
  );
}
