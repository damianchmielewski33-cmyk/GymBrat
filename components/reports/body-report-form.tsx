"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, ClipboardList, ImageIcon, Ruler, Sparkles, Zap } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { ReportSubmitPopup, type ReportSubmitPhase, type ReportSubmitSummary } from "@/components/reports/report-submit-popup";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { ConsentRequiredDialog } from "@/components/consent/consent-required-dialog";
import { SENSITIVE_CONSENT_COPY, type SensitiveConsentType } from "@/lib/consents-client";
import { setSensitiveConsentAction } from "@/actions/consents";
import { FieldLabel, GhostBackButton, GoldButton, MeasureInput, PhotoSlotCard, ProgressSegments, ScoreBars, StepBadge, TakNieToggle } from "@/components/reports/body-report-form-parts";
import { type BodyReportFieldHints, DRAFT_KEY, type DraftPayload, PHOTO_SLOTS, type PhotoSlot, TOTAL_STEPS, fileToReportPhotoDataUrl, formatHintNumber, parseDecimal } from "@/components/reports/body-report-form-utils";

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
    setFieldError(null);
    if (s === 1) {
      const w = parseDecimal(weightKg);
      if (w == null || w <= 0) {
        setFieldError("Podaj wagę, to pole jest wymagane.");
        return false;
      }
      const waist = parseDecimal(waistCm);
      const thigh = parseDecimal(thighCm);
      const chest = parseDecimal(chestCm);
      const arm = parseDecimal(armCm);
      if (waist == null || waist <= 0) {
        setFieldError("Podaj obwód pasa (cm).");
        return false;
      }
      if (thigh == null || thigh <= 0) {
        setFieldError("Podaj obwód uda (cm).");
        return false;
      }
      if (chest == null || chest <= 0) {
        setFieldError("Podaj obwód klatki (cm).");
        return false;
      }
      if (arm == null || arm <= 0) {
        setFieldError("Podaj obwód ramienia (cm).");
        return false;
      }
      return true;
    }
    if (s === 2) {
      if (
        dayEnergy == null ||
        trainingEnergy == null ||
        digestionScore == null ||
        sleepQuality == null
      ) {
        setFieldError("Kliknij kreski, wszystkie cztery skale wymagane.");
        return false;
      }
      return true;
    }
    if (s === 3) {
      if (!cardioCompliance || !dietCompliance || !trainingCompliance) {
        setFieldError("Odpowiedz TAK lub NIE przy cardio, diecie i treningach.");
        return false;
      }
      const anyNie =
        cardioCompliance === "nie" ||
        dietCompliance === "nie" ||
        trainingCompliance === "nie";
      if (anyNie && !complianceNotes.trim()) {
        setFieldError("Napisz, czego nie udało się zrealizować i w jakim zakresie.");
        return false;
      }
      return true;
    }
    if (s === 4) {
      // Zdjęcia są opcjonalne; jeśli któreś dodano, potrzebna świadoma zgoda (art. 9 RODO).
      const hasAnyPhoto = PHOTO_SLOTS.some((slot) => Boolean(slotPhotos[slot.key]));
      if (hasAnyPhoto && !photosConsent) {
        setFieldError(
          "Zaznacz zgodę na zapis zdjęć sylwetki albo usuń dodane zdjęcia.",
        );
        return false;
      }
      return true;
    }
    return true;
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
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {fieldError ? (
        <p className="mt-4 text-sm font-medium text-red-300">{fieldError}</p>
      ) : null}

      {step === 1 ? (
        <div>
          <StepBadge
            icon={<Ruler className="h-5 w-5" />}
            step={1}
            title="Pomiary"
            subtitle="Rano, na czczo, po toalecie."
          />
          <div className="mt-5 space-y-4">
            <MeasureInput
              id="weightKg"
              label="Waga (kg)"
              value={weightKg}
              onChange={setWeightKg}
              required
              large
              invalid={Boolean(fieldError && !parseDecimal(weightKg))}
              hint={formatHintNumber(lastHints?.weightKg ?? null)}
            />
            <div className="grid grid-cols-2 gap-3">
              <MeasureInput
                id="waistCm"
                label="Pas (cm)"
                value={waistCm}
                onChange={setWaistCm}
                required
                invalid={Boolean(fieldError && !parseDecimal(waistCm))}
                hint={formatHintNumber(lastHints?.waistCm ?? null)}
              />
              <MeasureInput
                id="thighCm"
                label="Udo (cm)"
                value={thighCm}
                onChange={setThighCm}
                required
                invalid={Boolean(fieldError && !parseDecimal(thighCm))}
                hint={formatHintNumber(lastHints?.thighCm ?? null)}
              />
              <MeasureInput
                id="chestCm"
                label="Klatka (cm)"
                value={chestCm}
                onChange={setChestCm}
                required
                invalid={Boolean(fieldError && !parseDecimal(chestCm))}
                hint={formatHintNumber(lastHints?.chestCm ?? null)}
              />
              <MeasureInput
                id="armCm"
                label="Ramię (cm)"
                value={armCm}
                onChange={setArmCm}
                required
                invalid={Boolean(fieldError && !parseDecimal(armCm))}
                hint={formatHintNumber(lastHints?.armCm ?? null)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <StepBadge
            icon={<Zap className="h-5 w-5" />}
            step={2}
            title="Samopoczucie"
            subtitle="Kliknij kreski, wszystkie cztery skale wymagane."
          />
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <ScoreBars
              label="Energia w dzień"
              value={dayEnergy}
              onChange={setDayEnergy}
              invalid={Boolean(fieldError) && dayEnergy == null}
              hint={lastHints?.dayEnergy ?? null}
            />
            <ScoreBars
              label="Energia treningu"
              value={trainingEnergy}
              onChange={setTrainingEnergy}
              invalid={Boolean(fieldError) && trainingEnergy == null}
              hint={lastHints?.trainingEnergy ?? null}
            />
            <ScoreBars
              label="Trawienie"
              value={digestionScore}
              onChange={setDigestionScore}
              invalid={Boolean(fieldError) && digestionScore == null}
              hint={lastHints?.digestionScore ?? null}
            />
            <ScoreBars
              label="Sen"
              value={sleepQuality}
              onChange={setSleepQuality}
              invalid={Boolean(fieldError) && sleepQuality == null}
              hint={lastHints?.sleepQuality ?? null}
            />
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          <StepBadge
            icon={<Check className="h-5 w-5" />}
            step={3}
            title="Zgodność z planem"
            subtitle="Szczerze, plan dopasuje się do prawdy."
          />
          <div className="mt-5 flex flex-col gap-4 sm:flex-row">
            <TakNieToggle
              label="Cardio"
              value={cardioCompliance}
              onChange={setCardioCompliance}
              invalid={Boolean(fieldError) && !cardioCompliance}
              hint={lastHints?.cardioCompliance ?? null}
            />
            <TakNieToggle
              label="Dieta"
              value={dietCompliance}
              onChange={setDietCompliance}
              invalid={Boolean(fieldError) && !dietCompliance}
              hint={lastHints?.dietCompliance ?? null}
            />
            <TakNieToggle
              label="Treningi"
              value={trainingCompliance}
              onChange={setTrainingCompliance}
              invalid={Boolean(fieldError) && !trainingCompliance}
              hint={lastHints?.trainingCompliance ?? null}
            />
          </div>
          {cardioCompliance === "nie" ||
          dietCompliance === "nie" ||
          trainingCompliance === "nie" ? (
            <div className="mt-5">
              <FieldLabel required htmlFor="complianceNotes">
                Czego nie udało się zrealizować i w jakim zakresie?
              </FieldLabel>
              <textarea
                id="complianceNotes"
                aria-required="true"
                rows={3}
                value={complianceNotes}
                onChange={(e) => setComplianceNotes(e.target.value)}
                placeholder="np. cardio 1× zamiast 2×, delegacja w tygodniu"
                className="w-full resize-y rounded-xl border border-[var(--gym-gold)]/22 bg-black/45 px-3 py-2.5 text-sm text-white placeholder:text-white/50 outline-none focus-visible:border-[var(--gym-gold)]/55 focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/25"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 4 ? (
        <div>
          <StepBadge
            icon={<ImageIcon className="h-5 w-5" />}
            step={4}
            title="Zdjęcia sylwetki"
            subtitle="Opcjonalne: przód, bok i tył."
          />
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {PHOTO_SLOTS.map((slot) => (
              <PhotoSlotCard
                key={slot.key}
                label={slot.label}
                src={slotPhotos[slot.key]}
                disabled={pending}
                onPick={(file) => pickSlotPhoto(slot.key, file)}
                onClear={() =>
                  setSlotPhotos((prev) => ({ ...prev, [slot.key]: null }))
                }
              />
            ))}
          </div>
          {PHOTO_SLOTS.some((slot) => Boolean(slotPhotos[slot.key])) ? (
            <div className="mt-4 rounded-xl border border-[var(--gym-gold)]/25 bg-black/35 p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  id="photosConsent"
                  type="checkbox"
                  checked={photosConsent}
                  onChange={(e) => setPhotosConsent(e.target.checked)}
                  aria-required="true"
                  aria-invalid={Boolean(fieldError) && !photosConsent ? true : undefined}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--gym-gold)]"
                />
                <span className="text-[13px] leading-relaxed text-white/75">
                  <span className="font-semibold text-white">
                    Wyrażam zgodę na zapis zdjęć sylwetki, wymagane.
                  </span>{" "}
                  {SENSITIVE_CONSENT_COPY.photos.body}
                </span>
              </label>
            </div>
          ) : (
            <p className="mt-4 text-[12px] text-white/50">
              Możesz pominąć ten krok — zdjęcia nie są wymagane do zapisu raportu.
            </p>
          )}
        </div>
      ) : null}

      {step === 5 ? (
        <div>
          <StepBadge
            icon={<Sparkles className="h-5 w-5" />}
            step={5}
            title="Podsumowanie"
            subtitle="Sprawdź dane i zapisz raport."
          />

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(
              [
                ["Waga", parseDecimal(weightKg) != null ? `${parseDecimal(weightKg)} kg` : "—"],
                ["Pas", parseDecimal(waistCm) != null ? `${parseDecimal(waistCm)} cm` : "—"],
                ["Udo", parseDecimal(thighCm) != null ? `${parseDecimal(thighCm)} cm` : "—"],
                ["Klatka", parseDecimal(chestCm) != null ? `${parseDecimal(chestCm)} cm` : "—"],
                ["Ramię", parseDecimal(armCm) != null ? `${parseDecimal(armCm)} cm` : "—"],
              ] as const
            ).map(([label, val]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-black/35 px-3 py-2.5"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
                  {label}
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--gym-gold)]">{val}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gym-gold)]/85">
              Ogólne — samopoczucie
            </p>
            <ScoreBars label="Energia dnia" value={dayEnergy} readOnly />
            <ScoreBars label="Energia treningowa" value={trainingEnergy} readOnly />
            <ScoreBars label="Trawienie" value={digestionScore} readOnly />
            <ScoreBars label="Sen" value={sleepQuality} readOnly />
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gym-gold)]/85">
              Zgodność z planem
            </p>
            <div className="flex gap-2">
              <TakNieToggle label="Cardio" value={cardioCompliance} readOnly />
              <TakNieToggle label="Dieta" value={dietCompliance} readOnly />
              <TakNieToggle label="Treningi" value={trainingCompliance} readOnly />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gym-gold)]/85">
              Zdjęcia
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PHOTO_SLOTS.map((s) => {
                const src = slotPhotos[s.key];
                return (
                  <div
                    key={s.key}
                    className="overflow-hidden rounded-xl border border-white/12 bg-black/40"
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt={s.label}
                        className="aspect-[3/4] w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[3/4] items-center justify-center text-[10px] text-white/50">
                        Brak
                      </div>
                    )}
                    <p className="px-1.5 py-1 text-center text-[10px] font-medium uppercase tracking-wide text-white/55">
                      {s.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <FieldLabel htmlFor="additionalInfo">Informacje dodatkowe (opcjonalne)</FieldLabel>
            <textarea
              id="additionalInfo"
              rows={3}
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder="Opcjonalnie…"
              className="w-full resize-y rounded-xl border border-[var(--gym-gold)]/22 bg-black/45 px-3 py-2.5 text-sm text-white placeholder:text-white/50 outline-none focus-visible:border-[var(--gym-gold)]/55 focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/25"
            />
          </div>
        </div>
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
