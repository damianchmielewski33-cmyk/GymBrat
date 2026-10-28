"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, FileUp } from "lucide-react";
import { AppPageHeader } from "@/components/layout/screen";
import { Button, buttonVariants } from "@/components/ui/button";
import { FilePickerButton } from "@/components/ui/file-picker-button";
import { InlineBanner } from "@/components/ui/inline-banner";
import { Input } from "@/components/ui/input";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { isLikelyEmptyUpload } from "@/lib/file-snapshot";
import {
  ConfidenceBadge,
  type ConfidenceDisplay,
} from "@/components/plany/confidence-badge";
import type { PreviewDay } from "@/lib/workout-plan/import-parse";
import { cn } from "@/lib/utils";

type PreviewExerciseView = PreviewDay["exercises"][number] & {
  corrected?: boolean;
};
type PreviewDayView = Omit<PreviewDay, "exercises"> & {
  exercises: PreviewExerciseView[];
};

function displayConfidence(ex: PreviewExerciseView): ConfidenceDisplay {
  if (ex.corrected) return "corrected";
  return ex.confidence;
}

function needsReview(ex: PreviewExerciseView): boolean {
  if (ex.corrected || ex.reviewed) return false;
  return ex.confidence === "low" || ex.confidence === "name_check";
}

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
  const mime = (file.type || "").toLowerCase();
  return (
    mime.includes("pdf") ||
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime.includes("msword") ||
    mime.includes("wordprocessingml") ||
    mime === "application/octet-stream" ||
    mime === ""
  );
}

function namedUploadFile(file: File): File {
  if (file.name && /\.(pdf|doc|docx|xlsx|xls|xlsm)$/i.test(file.name)) return file;
  const mime = (file.type || "").toLowerCase();
  let ext = "xlsx";
  if (mime.includes("pdf")) ext = "pdf";
  else if (mime.includes("wordprocessingml") || mime === "application/msword") {
    ext = mime.includes("wordprocessingml") ? "docx" : "doc";
  }
  const base =
    (file.name || "").replace(/\.[^.]+$/, "").trim() || "plan-treningowy";
  return new File([file], `${base}.${ext}`, {
    type: file.type || "application/octet-stream",
    lastModified: file.lastModified,
  });
}

export function ImportClient() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [days, setDays] = useState<PreviewDayView[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [onlyReview, setOnlyReview] = useState(false);
  const [pending, start] = useTransition();

  const reviewCount = useMemo(
    () =>
      days.reduce(
        (n, d) => n + d.exercises.filter((e) => needsReview(e)).length,
        0,
      ),
    [days],
  );

  const selectedStats = useMemo(() => {
    let plans = 0;
    let exercises = 0;
    for (const d of days) {
      if (!d.selected) continue;
      const selectedEx = d.exercises.filter((e) => e.selected);
      if (selectedEx.length === 0) continue;
      plans += 1;
      exercises += selectedEx.length;
    }
    return { plans, exercises };
  }, [days]);

  const canConfirm =
    selectedStats.plans > 0 &&
    days.every((d) =>
      !d.selected
        ? true
        : d.exercises
            .filter((e) => e.selected && e.confidence === "low")
            .every((e) => e.reviewed || e.corrected),
    );

  function runPreview() {
    if (!file) {
      setError("Najpierw wybierz plik.");
      return;
    }
    start(async () => {
      setError(null);
      try {
        if (isLikelyEmptyUpload(file)) {
          setError("Plik wygląda na pusty. Wybierz ponownie z folderu Pobrane.");
          return;
        }
        await ensureCsrfCookie();
        const fd = new FormData();
        fd.append("file", namedUploadFile(file));
        const res = await fetch("/api/workout-plans/import/preview", {
          method: "POST",
          headers: getXsrfHeaders(),
          body: fd,
        });
        const data = (await res.json()) as {
          ok: boolean;
          error?: string;
          days?: PreviewDay[];
          warnings?: string[];
          fileName?: string;
        };
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Nie udało się przeanalizować pliku.");
          return;
        }
        setDays(data.days ?? []);
        setWarnings(data.warnings ?? []);
        setFileName(data.fileName ?? file.name);
        setStep(2);
      } catch {
        setError("Brak połączenia. Spróbuj ponownie.");
      }
    });
  }

  function runConfirm() {
    start(async () => {
      setError(null);
      try {
        await ensureCsrfCookie();
        const payload = {
          days: days
            .filter((d) => d.selected)
            .map((d) => ({
              version: 2 as const,
              path: "custom" as const,
              planName: d.planName,
              userCustomExerciseNames: [] as string[],
              exercises: d.exercises
                .filter((e) => e.selected)
                .map(
                  ({
                    confidence: _c,
                    matchedCatalogId: _m,
                    matchedCatalogName: _n,
                    selected: _s,
                    reviewed: _r,
                    ...ex
                  }) => ex,
                ),
            }))
            .filter((d) => d.exercises.length > 0),
        };
        const res = await fetch("/api/workout-plans/import/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getXsrfHeaders(),
          },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as {
          ok: boolean;
          error?: string;
          ids?: string[];
        };
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Nie udało się zapisać planów.");
          return;
        }
        if (data.ids?.length === 1) {
          router.push(`/plany/${data.ids[0]}`);
        } else {
          router.push("/plany");
        }
        router.refresh();
      } catch {
        setError("Brak połączenia. Podgląd zostaje — spróbuj ponownie.");
      }
    });
  }

  return (
    <div className="px-1 pb-28 pt-1 sm:px-0">
      <div className="mb-1 flex items-center gap-1">
        <Link
          href={step === 1 ? "/plany/nowy" : "#"}
          onClick={(e) => {
            if (step === 2) {
              e.preventDefault();
              setStep(1);
            }
          }}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white"
          aria-label="Wstecz"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
      </div>

      {step === 1 ? (
        <>
          <AppPageHeader
            kicker="Nowy plan · Z pliku"
            title="Wybierz plik"
            description="PDF, Word (.doc, .docx) albo Excel (.xlsx, .xls, .xlsm). Maks. 8 MB."
          />
          {error ? (
            <InlineBanner variant="error" className="mt-4">
              {error}
            </InlineBanner>
          ) : null}
          <div className="mt-5 rounded-[22px] border border-dashed border-[rgba(235,196,74,0.5)] p-5 text-center">
            <FileUp className="mx-auto h-8 w-8 text-[var(--gym-gold)]" aria-hidden />
            <p className="mt-3 text-[15px] font-semibold text-white">
              Wybierz plik z urządzenia
            </p>
            <p className="mt-1 text-[12px] text-[var(--gym-text-secondary)]">
              Nie wysyłamy go, dopóki nie potwierdzisz wyniku podglądu.
            </p>
            <div className="mt-4">
              <FilePickerButton
                accept="*/*"
                emptyLabel="Wybierz plik"
                valueLabel={
                  file
                    ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB`
                    : undefined
                }
                onFiles={(files) => {
                  const f = files[0];
                  if (!f) return;
                  if (!isSupportedPlanFile(f)) {
                    setError("Nieobsługiwany format pliku.");
                    return;
                  }
                  setError(null);
                  setFile(f);
                }}
              />
            </div>
          </div>
          <div className="app-card mt-4 border border-white/10 p-4">
            <p className="text-[13px] leading-relaxed text-[var(--gym-text-secondary)]">
              Każdy dzień zaczyna się nagłówkiem (np. „Dzień A”). Pod nim: ćwiczenie,
              serie i powtórzenia.
            </p>
          </div>
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[rgba(7,7,8,0.96)] px-4 pb-4 pt-3">
            <div className="mx-auto max-w-xl">
              <Button
                type="button"
                variant="cta"
                className="h-12 w-full"
                disabled={!file || pending}
                aria-busy={pending}
                onClick={runPreview}
              >
                {pending ? "Analizuję plik…" : "Dalej: podgląd"}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          <AppPageHeader
            kicker={`Z pliku · ${fileName}`}
            title="Sprawdź przed zapisem"
            description="Odznacz to, czego nie chcesz zapisać. Możesz poprawić nazwy i liczby."
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/15 px-2.5 py-1 text-[12px] font-semibold text-[var(--gym-text-secondary)]">
              {days.length} plany
            </span>
            {reviewCount > 0 ? (
              <button
                type="button"
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[12px] font-semibold",
                  onlyReview
                    ? "border-[rgba(235,196,74,0.55)] text-[var(--gym-gold)]"
                    : "border-white/15 text-[var(--gym-text-secondary)]",
                )}
                onClick={() => setOnlyReview((v) => !v)}
              >
                Tylko do sprawdzenia · {reviewCount}
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-[12px] text-[var(--gym-text-secondary)]">
            Pewność odczytu z pliku. Sprawdź wiersze z plakietką przed zapisem.
          </p>
          {error ? (
            <InlineBanner variant="error" className="mt-3">
              {error}
            </InlineBanner>
          ) : null}
          {warnings.length > 0 ? (
            <InlineBanner variant="warning" className="mt-3">
              {warnings[0]}
            </InlineBanner>
          ) : null}

          <div className="mt-4 space-y-4">
            {days.map((day, di) => (
              <section key={`${day.planName}-${di}`} className="app-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-semibold text-white">
                      {day.planName}
                    </h2>
                    <p className="text-[12px] text-[var(--gym-text-secondary)]">
                      {day.exercises.length} ćwiczeń
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={day.selected}
                    aria-label={`Zapisz dzień ${day.planName}`}
                    className={cn(
                      "relative h-7 w-12 rounded-full",
                      day.selected ? "bg-[var(--gym-gold)]" : "bg-white/12",
                    )}
                    onClick={() =>
                      setDays((prev) =>
                        prev.map((d, i) =>
                          i === di ? { ...d, selected: !d.selected } : d,
                        ),
                      )
                    }
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white transition",
                        day.selected ? "left-[22px]" : "left-0.5",
                      )}
                    />
                  </button>
                </div>
                <ul className="mt-3 space-y-3">
                  {day.exercises
                    .filter((ex) => (onlyReview ? needsReview(ex) : true))
                    .map((ex) => {
                      const ei = day.exercises.findIndex((row) => row.id === ex.id);
                      return (
                      <li
                        key={ex.id}
                        className={cn(
                          "rounded-2xl border p-3",
                          ex.confidence === "low" && !ex.corrected
                            ? "border-[rgba(255,51,71,0.35)]"
                            : ex.confidence === "name_check" && !ex.corrected
                              ? "border-[rgba(235,196,74,0.35)]"
                              : "border-white/10",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1 h-5 w-5"
                            checked={ex.selected}
                            aria-label={`Zapisz ${ex.name}`}
                            onChange={() =>
                              setDays((prev) =>
                                prev.map((d, i) =>
                                  i !== di
                                    ? d
                                    : {
                                        ...d,
                                        exercises: d.exercises.map((row, j) =>
                                          j === ei
                                            ? {
                                                ...row,
                                                selected: !row.selected,
                                                reviewed:
                                                  row.confidence === "low"
                                                    ? true
                                                    : row.reviewed,
                                              }
                                            : row,
                                        ),
                                      },
                                ),
                              )
                            }
                          />
                          <div className="min-w-0 flex-1 space-y-2">
                            <ConfidenceBadge level={displayConfidence(ex)} />
                            <Input
                              className="h-11"
                              value={ex.name}
                              onChange={(e) =>
                                setDays((prev) =>
                                  prev.map((d, i) =>
                                    i !== di
                                      ? d
                                      : {
                                          ...d,
                                          exercises: d.exercises.map((row, j) =>
                                            j === ei
                                              ? {
                                                  ...row,
                                                  name: e.target.value,
                                                  reviewed: true,
                                                  corrected: true,
                                                }
                                              : row,
                                          ),
                                        },
                                  ),
                                )
                              }
                            />
                            <div className="flex gap-2">
                              <Input
                                className="h-11 w-20 text-center tabular-nums"
                                inputMode="numeric"
                                value={ex.sets}
                                aria-label="Serie"
                                onChange={(e) => {
                                  const n = Number(e.target.value.replace(/\D/g, ""));
                                  setDays((prev) =>
                                    prev.map((d, i) =>
                                      i !== di
                                        ? d
                                        : {
                                            ...d,
                                            exercises: d.exercises.map((row, j) =>
                                              j === ei
                                                ? {
                                                    ...row,
                                                    sets: Math.min(
                                                      20,
                                                      Math.max(1, n || 1),
                                                    ),
                                                    reviewed: true,
                                                    corrected: true,
                                                  }
                                                : row,
                                            ),
                                          },
                                    ),
                                  );
                                }}
                              />
                              <Input
                                className="h-11 w-24 text-center tabular-nums"
                                inputMode="numeric"
                                value={ex.reps}
                                aria-label="Powtórzenia"
                                onChange={(e) => {
                                  const n = Number(e.target.value.replace(/\D/g, ""));
                                  setDays((prev) =>
                                    prev.map((d, i) =>
                                      i !== di
                                        ? d
                                        : {
                                            ...d,
                                            exercises: d.exercises.map((row, j) =>
                                              j === ei
                                                ? {
                                                    ...row,
                                                    reps: Math.min(
                                                      999,
                                                      Math.max(1, n || 1),
                                                    ),
                                                    reviewed: true,
                                                    corrected: true,
                                                  }
                                                : row,
                                            ),
                                          },
                                    ),
                                  );
                                }}
                              />
                            </div>
                            {ex.matchedCatalogName ? (
                              <p className="text-[12px] text-[var(--gym-text-secondary)]">
                                Dopasowano: {ex.matchedCatalogName}
                              </p>
                            ) : (
                              <p className="text-[12px] text-[var(--gym-text-secondary)]">
                                Brak w atlasie, zapisze się jako własne. Sprawdź nazwę.
                              </p>
                            )}
                            {ex.confidence === "low" &&
                            !ex.reviewed &&
                            !ex.corrected ? (
                              <Button
                                type="button"
                                variant="outline"
                                className="h-10"
                                onClick={() =>
                                  setDays((prev) =>
                                    prev.map((d, i) =>
                                      i !== di
                                        ? d
                                        : {
                                            ...d,
                                            exercises: d.exercises.map((row, j) =>
                                              j === ei
                                                ? { ...row, reviewed: true }
                                                : row,
                                            ),
                                          },
                                    ),
                                  )
                                }
                              >
                                Sprawdziłem
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                    })}
                </ul>
              </section>
            ))}
          </div>

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[rgba(7,7,8,0.96)] px-4 pb-4 pt-3">
            <div className="mx-auto max-w-xl space-y-2">
              <p className="text-[12px] text-[var(--gym-text-secondary)]" role="status">
                {canConfirm
                  ? `Zapiszesz ${selectedStats.plans} plany · ${selectedStats.exercises} ćwiczeń`
                  : reviewCount > 0
                    ? `Sprawdź jeszcze ${reviewCount} wierszy o niskiej pewności.`
                    : "Zaznacz co najmniej jeden dzień."}
              </p>
              <Button
                type="button"
                variant="cta"
                className="h-12 w-full"
                disabled={!canConfirm || pending}
                aria-busy={pending}
                onClick={runConfirm}
              >
                {pending
                  ? "Zapisuję…"
                  : `Zapisz ${selectedStats.plans || ""} plany`.trim()}
              </Button>
              <button
                type="button"
                className={cn(buttonVariants({ variant: "ghost" }), "h-11 w-full")}
                onClick={() => setStep(1)}
              >
                Wróć do wyboru pliku
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
