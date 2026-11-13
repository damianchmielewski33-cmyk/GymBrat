"use client";
import { ReportStepMeasurements, ReportStepWellbeing, ReportStepCompliance, ReportStepPhotos, ReportStepSummary } from "@/components/reports/body-report-form-steps";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ClipboardList } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { ReportSubmitPopup, type ReportSubmitPhase, type ReportSubmitSummary } from "@/components/reports/report-submit-popup";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { ConsentRequiredDialog } from "@/components/consent/consent-required-dialog";
import { type SensitiveConsentType } from "@/lib/consents-client";
import { setSensitiveConsentAction } from "@/actions/consents";
import { GhostBackButton, GoldButton, ProgressSegments } from "@/components/reports/body-report-form-parts";
import { type BodyReportFieldHints, DRAFT_KEY, type DraftPayload, PHOTO_SLOTS, type PhotoSlot, TOTAL_STEPS, fileToReportPhotoDataUrl, parseDecimal, validateReportStep } from "@/components/reports/body-report-form-utils";

export type { BodyReportFieldHints } from "@/components/reports/body-report-form-utils";

type BodyReportFormProps = {
  maxPhotos?: number;
  /** Dni do kolejnego raportu (np. z cyklu) — pokazywane w nagłówku karty. */
  daysUntilNext?: number | null;
  /** Wartości z ostatniego raportu — podpowiedzi w tle pól (placeholder / ghost). */
  lastHints?: BodyReportFieldHints | null;
};

export function BodyReportForm({
  maxPhotos = 8,
  daysUntilNext = null,
  lastHints = null,
}: BodyReportFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notifySaved } = useSaveFeedback();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [consentNeeded, setConsentNeeded] = useState<SensitiveConsentType | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const wantNew =
    searchParams.get("new") === "1" || searchParams.get("new") === "true";
  const [isOpen, setIsOpen] = useState(wantNew);
  const [step, setStep] = useState(1);

  const [weightKg, setWeightKg] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [chestCm, setChestCm] = useState("");
  const [thighCm, setThighCm] = useState("");
  const [armCm, setArmCm] = useState("");

  const [dayEnergy, setDayEnergy] = useState<number | null>(null);
  const [trainingEnergy, setTrainingEnergy] = useState<number | null>(null);
  const [digestionScore, setDigestionScore] = useState<number | null>(null);
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);

  const [cardioCompliance, setCardioCompliance] = useState<"" | "tak" | "nie">("");
  const [dietCompliance, setDietCompliance] = useState<"" | "tak" | "nie">("");
  const [trainingCompliance, setTrainingCompliance] = useState<"" | "tak" | "nie">("");
  const [complianceNotes, setComplianceNotes] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  const [slotPhotos, setSlotPhotos] = useState<Record<PhotoSlot, string | null>>({
    front: null,
    side: null,
    back: null,
  });
  const [submitPhase, setSubmitPhase] = useState<ReportSubmitPhase>("idle");
  /** Z64: zgoda na zdjęcia sylwetki — wymagana tylko, gdy użytkownik dodał zdjęcie. */
  const [photosConsent, setPhotosConsent] = useState(false);
  const [submitSummary, setSubmitSummary] = useState<ReportSubmitSummary | null>(
    null,
  );

  const dueLabel = useMemo(() => {
    if (daysUntilNext == null) return null;
    if (daysUntilNext <= 0) return "TERAZ";
    return `ZA ${daysUntilNext} DNI`;
  }, [daysUntilNext]);

  const resetForm = () => {
    setStep(1);
    setError(null);
    setFieldError(null);
    setWeightKg("");
    setWaistCm("");
    setChestCm("");
    setThighCm("");
    setArmCm("");
    setDayEnergy(null);
    setTrainingEnergy(null);
    setDigestionScore(null);
    setSleepQuality(null);
    setCardioCompliance("");
    setDietCompliance("");
    setTrainingCompliance("");
    setComplianceNotes("");
    setAdditionalInfo("");
    setSlotPhotos({ front: null, side: null, back: null });
    setPhotosConsent(false);
  };

  const openWizard = (opts?: { restoreDraft?: boolean }) => {
    if (opts?.restoreDraft !== false) {
      try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (raw) {
          const d = JSON.parse(raw) as DraftPayload;
          setStep(typeof d.step === "number" ? Math.min(TOTAL_STEPS, Math.max(1, d.step)) : 1);
          setWeightKg(d.weightKg ?? "");
          setWaistCm(d.waistCm ?? "");
          setChestCm(d.chestCm ?? "");
          setThighCm(d.thighCm ?? "");
          setArmCm(d.armCm ?? "");
          setDayEnergy(d.dayEnergy ?? null);
          setTrainingEnergy(d.trainingEnergy ?? null);
          setDigestionScore(d.digestionScore ?? null);
          setSleepQuality(d.sleepQuality ?? null);
          setCardioCompliance(d.cardioCompliance ?? "");
          setDietCompliance(d.dietCompliance ?? "");
          setTrainingCompliance(d.trainingCompliance ?? "");
          setComplianceNotes(d.complianceNotes ?? "");
          setAdditionalInfo(d.additionalInfo ?? "");
        }
      } catch {
        /* ignore broken draft */
      }
    }
    setIsOpen(true);
    router.replace("/reports?new=1", { scroll: false });
  };

  const closeWizard = (opts?: { clearDraft?: boolean }) => {
    if (opts?.clearDraft !== false) {
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      resetForm();
    }
    setIsOpen(false);
    router.replace("/reports", { scroll: false });
  };

  // Wejście z FAB / linku ?new=1 — od razu start wizarda + przywróć wpisane pola.
  useEffect(() => {
    if (!wantNew) return;
    setIsOpen(true);
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as DraftPayload;
      setStep(typeof d.step === "number" ? Math.min(TOTAL_STEPS, Math.max(1, d.step)) : 1);
      setWeightKg(d.weightKg ?? "");
      setWaistCm(d.waistCm ?? "");
      setChestCm(d.chestCm ?? "");
      setThighCm(d.thighCm ?? "");
      setArmCm(d.armCm ?? "");
      setDayEnergy(d.dayEnergy ?? null);
      setTrainingEnergy(d.trainingEnergy ?? null);
      setDigestionScore(d.digestionScore ?? null);
      setSleepQuality(d.sleepQuality ?? null);
      setCardioCompliance(d.cardioCompliance ?? "");
      setDietCompliance(d.dietCompliance ?? "");
      setTrainingCompliance(d.trainingCompliance ?? "");
      setComplianceNotes(d.complianceNotes ?? "");
      setAdditionalInfo(d.additionalInfo ?? "");
    } catch {
      /* ignore */
    }
  }, [wantNew]);

  // Trzymaj wpisane wartości przy Wstecz / zmianie kroku (draft bez zdjęć).
  useEffect(() => {
    if (!isOpen) return;
    const draft: DraftPayload = {
      step,
      weightKg,
      waistCm,
      chestCm,
      thighCm,
      armCm,
      dayEnergy,
      trainingEnergy,
      digestionScore,
      sleepQuality,
      cardioCompliance,
      dietCompliance,
      trainingCompliance,
      complianceNotes,
      additionalInfo,
    };
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* quota */
    }
  }, [
    isOpen,
    step,
    weightKg,
    waistCm,
    chestCm,
    thighCm,
    armCm,
    dayEnergy,
    trainingEnergy,
    digestionScore,
    sleepQuality,
    cardioCompliance,
    dietCompliance,
    trainingCompliance,
    complianceNotes,
    additionalInfo,
  ]);

  const validateStep = (s: number): boolean => {
    const msg = validateReportStep(s, { weightKg, waistCm, thighCm, chestCm, armCm, dayEnergy, trainingEnergy, digestionScore, sleepQuality, cardioCompliance, dietCompliance, trainingCompliance, complianceNotes, slotPhotos, photosConsent });
    setFieldError(msg);
    return msg == null;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const goBack = () => {
    setFieldError(null);
    setError(null);
    // Wartości pól zostają — tylko cofamy krok.
    setStep((s) => Math.max(1, s - 1));
  };

  const pickSlotPhoto = (slot: PhotoSlot, file: File) => {
    setError(null);
    start(async () => {
      try {
        const dataUrl = await fileToReportPhotoDataUrl(file);
        setSlotPhotos((prev) => ({ ...prev, [slot]: dataUrl }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nie udało się wczytać zdjęcia");
      }
    });
  };

  const submit = () => {
    for (const s of [1, 2, 3, 4] as const) {
      if (!validateStep(s)) {
        setStep(s);
        return;
      }
    }
    setError(null);
    const photos = PHOTO_SLOTS.map((s) => slotPhotos[s.key]).filter(
      (p): p is string => Boolean(p),
    );
    const summarySnapshot: ReportSubmitSummary = {
      weightKg: parseDecimal(weightKg),
      dayEnergy,
      sleepQuality,
      dietCompliance,
      trainingCompliance,
      cardioCompliance,
      photosCount: photos.length,
    };
    setSubmitSummary(summarySnapshot);
    setSubmitPhase("saving");
    start(async () => {
      try {
        if (photos.length > 0 && photosConsent) {
          // Zaznaczony checkbox = zapis zgody na zdjęcia (dowód: źródło „body_report”).
          const consent = await setSensitiveConsentAction("photos", true, "body_report");
          if (!consent.ok) {
            setSubmitPhase("idle");
            setError(consent.error);
            return;
          }
        }
        await ensureCsrfCookie();
        const res = await fetch("/api/body-reports", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...getXsrfHeaders(),
          },
          body: JSON.stringify({
            weightKg: summarySnapshot.weightKg,
            waistCm: parseDecimal(waistCm),
            chestCm: parseDecimal(chestCm),
            thighCm: parseDecimal(thighCm),
            armCm: parseDecimal(armCm),
            trainingEnergy,
            sleepQuality,
            dayEnergy,
            digestionScore,
            cardioCompliance: cardioCompliance || null,
            dietCompliance: dietCompliance || null,
            trainingCompliance: trainingCompliance || null,
            complianceNotes: complianceNotes.trim() || null,
            additionalInfo: additionalInfo.trim() || null,
            photoDataUrls: photos.slice(0, maxPhotos),
          }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          error?: string;
          code?: string;
          consent?: SensitiveConsentType;
        };
        if (!json.ok) {
          setSubmitPhase("idle");
          // Z11: serwer wymaga zgody (dane o ciele / zdjęcia) — pokaż okno zgody i ponów zapis.
          if (json.code === "CONSENT_REQUIRED" && json.consent) {
            setConsentNeeded(json.consent);
            return;
          }
          setError(json.error ?? "Nie udało się zapisać raportu.");
          return;
        }
        closeWizard({ clearDraft: true });
        setSubmitPhase("success");
        notifySaved("Zapisano raport.");
      } catch (err) {
        setSubmitPhase("idle");
        setError(err instanceof Error ? err.message : "Nieznany błąd");
      }
    });
  };

  const submitPopup = (
    <>
      <ReportSubmitPopup
        phase={submitPhase}
        summary={submitSummary}
        onClose={() => {
          setSubmitPhase("idle");
          setSubmitSummary(null);
          router.refresh();
        }}
      />
      {consentNeeded ? (
        <ConsentRequiredDialog
          type={consentNeeded}
          onCancel={() => setConsentNeeded(null)}
          onGranted={() => {
            setConsentNeeded(null);
            submit();
          }}
        />
      ) : null}
    </>
  );

  if (!isOpen) {
    return (
      <>
        {submitPopup}
        <div className="theme-black-gold overflow-hidden rounded-3xl border border-white/10 bg-[#141416]/90 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--gym-gold)]/80">
                Nowy raport
              </p>
              <p className="mt-1 text-sm text-white/60">
                Pomiary, samopoczucie, zgodność z planem i zdjęcia — krok po kroku.
              </p>
            </div>
            <GoldButton
              onClick={() => openWizard({ restoreDraft: true })}
              className="w-full sm:w-auto"
              disabled={submitPhase === "saving"}
            >
              Dodaj raport
            </GoldButton>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
    {submitPopup}
    <div className="theme-black-gold overflow-hidden rounded-3xl border border-white/[0.08] bg-[#161618] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[var(--gym-gold)]" aria-hidden />
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/85">
            Nowy raport
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dueLabel ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
              {dueLabel}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => closeWizard({ clearDraft: true })}
            className="text-[11px] font-medium uppercase tracking-wide text-white/50 underline-offset-2 hover:text-white/70 hover:underline"
          >
            Anuluj
          </button>
        </div>
      </div>

      <ProgressSegments step={step} />

      {error ? (
        <p className="mt-4 rounded-xl border border-state-error/30 bg-state-error/10 px-3 py-2 text-sm text-state-error">
          {error}
        </p>
      ) : null}
      {fieldError ? (
        <p className="mt-4 text-sm font-medium text-state-error">{fieldError}</p>
      ) : null}

      {step === 1 ? (
        <ReportStepMeasurements {...{ weightKg, waistCm, thighCm, chestCm, armCm, setWeightKg, setWaistCm, setThighCm, setChestCm, setArmCm, fieldError, lastHints }} />
      ) : null}

      {step === 2 ? (
        <ReportStepWellbeing {...{ dayEnergy, trainingEnergy, digestionScore, sleepQuality, setDayEnergy, setTrainingEnergy, setDigestionScore, setSleepQuality, fieldError, lastHints }} />
      ) : null}

      {step === 3 ? (
        <ReportStepCompliance {...{ cardioCompliance, dietCompliance, trainingCompliance, complianceNotes, setCardioCompliance, setDietCompliance, setTrainingCompliance, setComplianceNotes, fieldError, lastHints }} />
      ) : null}

      {step === 4 ? (
        <ReportStepPhotos {...{ slotPhotos, setSlotPhotos, pending, pickSlotPhoto, photosConsent, setPhotosConsent, fieldError }} />
      ) : null}

      {step === 5 ? (
        <ReportStepSummary {...{ weightKg, waistCm, thighCm, chestCm, armCm, dayEnergy, trainingEnergy, digestionScore, sleepQuality, cardioCompliance, dietCompliance, trainingCompliance, slotPhotos, additionalInfo, setAdditionalInfo }} />
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
        {step > 1 ? (
          <GhostBackButton onClick={goBack} disabled={pending} />
        ) : (
          <span />
        )}
        {step < TOTAL_STEPS ? (
          <GoldButton onClick={goNext} disabled={pending}>
            Dalej
            <ArrowRight className="h-4 w-4" aria-hidden />
          </GoldButton>
        ) : (
          <GoldButton onClick={submit} disabled={pending}>
            {pending ? "Zapisywanie…" : "Zapisz raport"}
          </GoldButton>
        )}
      </div>
    </div>
    </>
  );
}
