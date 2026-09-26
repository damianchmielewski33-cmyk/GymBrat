"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { FilePickerButton } from "@/components/ui/file-picker-button";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { isLikelyEmptyUpload } from "@/lib/file-snapshot";
import { cn } from "@/lib/utils";

/** Android DocumentsUI wyszarzza PDF, gdy accept ma „.pdf” zamiast MIME — używamy * /*. */
const PLAN_FILE_ACCEPT = "*/*";

function isSupportedPlanFile(file: File): boolean {
  const n = (file.name || "").toLowerCase();
  if (
    n.endsWith(".pdf") ||
    n.endsWith(".doc") ||
    n.endsWith(".docx") ||
    n.endsWith(".xlsx") ||
    n.endsWith(".xls") ||
    n.endsWith(".xlsm")
  ) {
    return true;
  }
  // Android WebView czasem oddaje pustą nazwę — wtedy polegamy na MIME / serwerze
  const mime = (file.type || "").toLowerCase();
  if (
    mime.includes("pdf") ||
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime.includes("msword") ||
    mime.includes("wordprocessingml") ||
    mime === "application/octet-stream" ||
    mime === ""
  ) {
    return true;
  }
  return false;
}

function namedUploadFile(file: File): File {
  if (file.name && /\.(pdf|doc|docx|xlsx|xls|xlsm)$/i.test(file.name)) return file;
  const mime = (file.type || "").toLowerCase();
  let ext = "xlsx";
  if (mime.includes("pdf")) {
    ext = "pdf";
  } else if (mime.includes("wordprocessingml") || mime === "application/msword") {
    ext = mime.includes("wordprocessingml") ? "docx" : "doc";
  } else if (mime.includes("spreadsheet") || mime.includes("excel")) {
    ext = "xlsx";
  }
  const base =
    (file.name || "").replace(/\.[^.]+$/, "").trim() || "plan-treningowy";
  return new File([file], `${base}.${ext}`, {
    type: file.type || "application/octet-stream",
    lastModified: file.lastModified,
  });
}

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
              Import planu
            </p>
            <p className="mt-1.5 text-sm text-white/50">
              Wgraj plan z PDF, Worda (.doc / .docx) albo Excela (.xlsx) —
              aplikacja utworzy dni/plany z ćwiczeniami, seriami i powtórzeniami.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10 px-4 text-sm font-semibold text-[var(--gym-gold)] hover:bg-[var(--gym-gold)]/15"
          >
            <FileUp className="h-4 w-4" aria-hidden />
            Importuj PDF / Word / Excel
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
              setError("Wybierz plik .pdf, .doc, .docx albo .xlsx.");
              return;
            }
            if (isLikelyEmptyUpload(file)) {
              setError(
                "Nie udało się odczytać pliku (pusty). Wybierz ponownie z folderu Pobrane.",
              );
              return;
            }
            if (!isSupportedPlanFile(file)) {
              setError(
                "Wybierz PDF, Word (.doc / .docx) albo Excel (.xlsx). Na telefonie: Pliki → Pobrane.",
              );
              return;
            }
            start(async () => {
              try {
                await ensureCsrfCookie();
                const upload = namedUploadFile(file);
                const fd = new FormData();
                fd.set("file", upload);
                fd.set("filename", upload.name || file.name || "plan.xlsx");
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
                    ? `Zaimportowano plan „${json.planNames?.[0] ?? "z pliku"}”.`
                    : `Zaimportowano ${json.imported} planów.`,
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
                Import planu
              </p>
              <h3 className="mt-1 text-base font-semibold text-white">
                PDF, Word (.doc / .docx) lub Excel (.xlsx)
              </h3>
              <p className="mt-1 text-xs text-white/45">
                Na Androidzie: wybierz plik z folderu Pobrane (nie z galerii). PDF/Word:
                nagłówki dni (Push, Pull, Nogi) + „2s 8-10p” albo „Przysiady 4x8”.
                Excel: kolumny dzień / ćwiczenie / serie / powtórzenia.
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
            accept={PLAN_FILE_ACCEPT}
            disabled={pending}
            onFiles={(files) => {
              const f = files[0] ?? null;
              setFile(f);
              if (f && isLikelyEmptyUpload(f)) {
                setError(
                  "Nie udało się odczytać pliku (pusty). Wybierz ponownie z folderu Pobrane.",
                );
                return;
              }
              setError(
                f && !isSupportedPlanFile(f)
                  ? "Ten typ pliku nie jest obsługiwany — wybierz .pdf, .doc, .docx lub .xlsx."
                  : null,
              );
            }}
            valueLabel={file ? file.name : undefined}
            emptyLabel="Wybierz plik (.pdf / .doc / .docx / .xlsx)"
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
            {pending ? "Importowanie…" : "Utwórz plany z pliku"}
          </button>
        </form>
      )}
    </section>
  );
}
