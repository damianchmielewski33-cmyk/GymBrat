"use client";

import { Check, ImageIcon, Ruler, Sparkles, Zap } from "lucide-react";
import { SENSITIVE_CONSENT_COPY } from "@/lib/consents-client";
import { FieldLabel, MeasureInput, PhotoSlotCard, ScoreBars, StepBadge, TakNieToggle } from "@/components/reports/body-report-form-parts";
import { type BodyReportFieldHints, PHOTO_SLOTS, type PhotoSlot, formatHintNumber, parseDecimal } from "@/components/reports/body-report-form-utils";
import type { Dispatch, SetStateAction } from "react";

type Compliance = "" | "tak" | "nie";

export function ReportStepMeasurements({ weightKg, waistCm, thighCm, chestCm, armCm, setWeightKg, setWaistCm, setThighCm, setChestCm, setArmCm, fieldError, lastHints }: {
  weightKg: string;
  waistCm: string;
  thighCm: string;
  chestCm: string;
  armCm: string;
  setWeightKg: Dispatch<SetStateAction<string>>;
  setWaistCm: Dispatch<SetStateAction<string>>;
  setThighCm: Dispatch<SetStateAction<string>>;
  setChestCm: Dispatch<SetStateAction<string>>;
  setArmCm: Dispatch<SetStateAction<string>>;
  fieldError: string | null;
  lastHints: BodyReportFieldHints | null | undefined;
}) {
  return (
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
  );
}

export function ReportStepWellbeing({ dayEnergy, trainingEnergy, digestionScore, sleepQuality, setDayEnergy, setTrainingEnergy, setDigestionScore, setSleepQuality, fieldError, lastHints }: {
  dayEnergy: number | null;
  trainingEnergy: number | null;
  digestionScore: number | null;
  sleepQuality: number | null;
  setDayEnergy: Dispatch<SetStateAction<number | null>>;
  setTrainingEnergy: Dispatch<SetStateAction<number | null>>;
  setDigestionScore: Dispatch<SetStateAction<number | null>>;
  setSleepQuality: Dispatch<SetStateAction<number | null>>;
  fieldError: string | null;
  lastHints: BodyReportFieldHints | null | undefined;
}) {
  return (
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
  );
}

export function ReportStepCompliance({ cardioCompliance, dietCompliance, trainingCompliance, complianceNotes, setCardioCompliance, setDietCompliance, setTrainingCompliance, setComplianceNotes, fieldError, lastHints }: {
  cardioCompliance: Compliance;
  dietCompliance: Compliance;
  trainingCompliance: Compliance;
  complianceNotes: string;
  setCardioCompliance: Dispatch<SetStateAction<Compliance>>;
  setDietCompliance: Dispatch<SetStateAction<Compliance>>;
  setTrainingCompliance: Dispatch<SetStateAction<Compliance>>;
  setComplianceNotes: Dispatch<SetStateAction<string>>;
  fieldError: string | null;
  lastHints: BodyReportFieldHints | null | undefined;
}) {
  return (
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
  );
}

export function ReportStepPhotos({ slotPhotos, setSlotPhotos, pending, pickSlotPhoto, photosConsent, setPhotosConsent, fieldError }: {
  slotPhotos: Record<PhotoSlot, string | null>;
  setSlotPhotos: Dispatch<SetStateAction<Record<PhotoSlot, string | null>>>;
  pending: boolean;
  pickSlotPhoto: (slot: PhotoSlot, file: File) => void;
  photosConsent: boolean;
  setPhotosConsent: Dispatch<SetStateAction<boolean>>;
  fieldError: string | null;
}) {
  return (
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
  );
}

export function ReportStepSummary({ weightKg, waistCm, thighCm, chestCm, armCm, dayEnergy, trainingEnergy, digestionScore, sleepQuality, cardioCompliance, dietCompliance, trainingCompliance, slotPhotos, additionalInfo, setAdditionalInfo }: {
  weightKg: string;
  waistCm: string;
  thighCm: string;
  chestCm: string;
  armCm: string;
  dayEnergy: number | null;
  trainingEnergy: number | null;
  digestionScore: number | null;
  sleepQuality: number | null;
  cardioCompliance: Compliance;
  dietCompliance: Compliance;
  trainingCompliance: Compliance;
  slotPhotos: Record<PhotoSlot, string | null>;
  additionalInfo: string;
  setAdditionalInfo: Dispatch<SetStateAction<string>>;
}) {
  return (
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
  );
}
