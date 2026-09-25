"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ClipboardList,
  ImageIcon,
  Ruler,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { cn } from "@/lib/utils";

type BodyReportFormProps = {
  maxPhotos?: number;
  /** Dni do kolejnego raportu (np. z cyklu) — pokazywane w nagłówku karty. */
  daysUntilNext?: number | null;
};

type PhotoSlot = "front" | "side" | "back";

const PHOTO_SLOTS: { key: PhotoSlot; label: string }[] = [
  { key: "front", label: "PRZÓD" },
  { key: "side", label: "BOK" },
  { key: "back", label: "TYŁ" },
];

const TOTAL_STEPS = 5;
const DRAFT_KEY = "gymbrat:body-report-draft:v1";

type DraftPayload = {
  step: number;
  weightKg: string;
  waistCm: string;
  chestCm: string;
  thighCm: string;
  armCm: string;
  abdomenCm: string;
  dayEnergy: number | null;
  trainingEnergy: number | null;
  digestionScore: number | null;
  sleepQuality: number | null;
  cardioCompliance: "" | "tak" | "nie";
  dietCompliance: "" | "tak" | "nie";
  trainingCompliance: "" | "tak" | "nie";
  complianceNotes: string;
  additionalInfo: string;
  /** Zdjęcia w draftcie pomijamy (za duże na sessionStorage). */
};

async function fileToResizedDataUrl(
  file: File,
  opts: { maxSide: number; quality: number },
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const max = Math.max(width, height);
  const scale = max > opts.maxSide ? opts.maxSide / max : 1;
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Brak canvas context");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", opts.quality);
}

/** Kompresja pod limit API (~1.5M znaków na zdjęcie). */
async function fileToReportPhotoDataUrl(file: File): Promise<string> {
  const attempts = [
    { maxSide: 960, quality: 0.72 },
    { maxSide: 720, quality: 0.62 },
    { maxSide: 560, quality: 0.55 },
  ];
  let last = "";
  for (const opts of attempts) {
    last = await fileToResizedDataUrl(file, opts);
    if (last.length <= 1_200_000) return last;
  }
  return last;
}

function parseDecimal(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t || t === "." || t === ",") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

function GoldButton({
  children,
  className,
  disabled,
  type = "button",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-12 min-w-[7.5rem] items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold tracking-wide text-[#0a0906]",
        "bg-gradient-to-b from-[#f0d56a] via-[#d4af37] to-[#b8922a]",
        "shadow-[0_0_24px_rgba(212,175,55,0.45),0_8px_20px_rgba(0,0,0,0.45)]",
        "transition hover:brightness-110 active:translate-y-px",
        "disabled:pointer-events-none disabled:opacity-45",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c547] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121214]",
        className,
      )}
    >
      {children}
    </button>
  );
}

function GhostBackButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-transparent px-4 text-sm font-medium text-white/90",
        "transition hover:bg-white/[0.06] disabled:opacity-40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
      )}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Wstecz
    </button>
  );
}

function ProgressSegments({ step }: { step: number }) {
  return (
    <div className="mt-4 flex gap-1.5" aria-hidden>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors",
            i < step ? "bg-[#d4af37]" : "bg-white/12",
          )}
        />
      ))}
    </div>
  );
}

function StepBadge({
  icon,
  step,
  title,
  subtitle,
}: {
  icon: ReactNode;
  step: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mt-5 flex gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#d4af37]/40 bg-[#d4af37]/12 text-[#d4af37]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
          Krok {step} z {TOTAL_STEPS}
        </p>
        <h3 className="font-heading text-xl font-semibold text-white">{title}</h3>
        <p className="mt-0.5 text-sm text-white/50">{subtitle}</p>
      </div>
    </div>
  );
}

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d4af37]/90">
      {children}
      {required ? <span className="text-[#d4af37]">, wymagane</span> : null}
    </p>
  );
}

function MeasureInput({
  id,
  label,
  value,
  onChange,
  required,
  large,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  large?: boolean;
  invalid?: boolean;
}) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=","
        aria-invalid={invalid || undefined}
        className={cn(
          "w-full rounded-xl border bg-black/50 px-3 text-white outline-none transition placeholder:text-white/25",
          "focus-visible:border-[#d4af37]/55 focus-visible:ring-2 focus-visible:ring-[#d4af37]/25",
          large ? "h-14 text-2xl font-semibold tabular-nums" : "h-12 text-lg tabular-nums",
          invalid ? "border-red-500/55" : "border-[#d4af37]/22",
        )}
      />
    </div>
  );
}

function ScoreBars({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  invalid?: boolean;
}) {
  return (
    <div>
      <p
        className={cn(
          "mb-2 text-[10px] font-semibold uppercase tracking-[0.16em]",
          invalid ? "text-red-300" : "text-white/55",
        )}
      >
        {label}
      </p>
      <div className="flex h-10 items-end gap-1" role="radiogroup" aria-label={label}>
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          const active = value != null && n <= value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              onClick={() => onChange(n)}
              className={cn(
                "flex-1 rounded-full transition",
                "h-full min-w-0",
                active
                  ? "bg-gradient-to-t from-[#b8922a] to-[#e8c547] shadow-[0_0_10px_rgba(212,175,55,0.35)]"
                  : "border border-white/18 bg-transparent hover:border-white/35",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

function TakNieToggle({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: "" | "tak" | "nie";
  onChange: (v: "tak" | "nie") => void;
  invalid?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p
        className={cn(
          "mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em]",
          invalid ? "text-red-300" : "text-white/50",
        )}
      >
        {label}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onChange("tak")}
          className={cn(
            "h-11 rounded-xl border text-sm font-semibold transition",
            value === "tak"
              ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-200"
              : "border-white/15 bg-black/35 text-white/70 hover:bg-white/[0.06]",
          )}
        >
          TAK
        </button>
        <button
          type="button"
          onClick={() => onChange("nie")}
          className={cn(
            "h-11 rounded-xl border text-sm font-semibold transition",
            value === "nie"
              ? "border-red-400/70 bg-red-500/20 text-red-200"
              : "border-white/15 bg-black/35 text-white/70 hover:bg-white/[0.06]",
          )}
        >
          NIE
        </button>
      </div>
    </div>
  );
}

function PhotoSlotCard({
  label,
  src,
  disabled,
  onPick,
  onClear,
}: {
  label: string;
  src: string | null;
  disabled?: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onPick(file);
  };

  return (
    <div className="relative min-h-[9.5rem] overflow-hidden rounded-2xl border border-[#d4af37]/25 bg-black/45">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={onChange}
      />
      {src ? (
        <>
          <Image
            src={src}
            alt={label}
            fill
            unoptimized
            className="object-cover"
            sizes="120px"
          />
          <button
            type="button"
            onClick={onClear}
            className="absolute right-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-1 text-white/85"
            aria-label={`Usuń zdjęcie ${label}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <p className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-bold tracking-[0.16em] text-[#d4af37]">
            {label}
          </p>
        </>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex h-full min-h-[9.5rem] w-full flex-col items-center justify-center gap-2 px-2 py-4 text-center disabled:opacity-50"
        >
          <Camera className="h-6 w-6 text-[#d4af37]" aria-hidden />
          <span className="text-[11px] font-bold tracking-[0.16em] text-[#d4af37]">{label}</span>
          <span className="h-px w-10 bg-white/15" aria-hidden />
          <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/40">
            Lub z galerii
          </span>
        </button>
      )}
    </div>
  );
}

export function BodyReportForm({
  maxPhotos = 8,
  daysUntilNext = null,
}: BodyReportFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notifySaved } = useSaveFeedback();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
  const [abdomenCm, setAbdomenCm] = useState("");

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
    setAbdomenCm("");
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
          setAbdomenCm(d.abdomenCm ?? "");
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
      setAbdomenCm(d.abdomenCm ?? "");
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
      abdomenCm,
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
    abdomenCm,
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
    for (const s of [1, 2, 3] as const) {
      if (!validateStep(s)) {
        setStep(s);
        return;
      }
    }
    setError(null);
    start(async () => {
      try {
        await ensureCsrfCookie();
        const photos = PHOTO_SLOTS.map((s) => slotPhotos[s.key]).filter(
          (p): p is string => Boolean(p),
        );
        const res = await fetch("/api/body-reports", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...getXsrfHeaders(),
          },
          body: JSON.stringify({
            weightKg: parseDecimal(weightKg),
            waistCm: parseDecimal(waistCm),
            chestCm: parseDecimal(chestCm),
            thighCm: parseDecimal(thighCm),
            armCm: parseDecimal(armCm),
            abdomenCm: parseDecimal(abdomenCm),
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
        const json = (await res.json()) as { ok: boolean; error?: string };
        if (!json.ok) {
          setError(json.error ?? "Nie udało się zapisać raportu.");
          return;
        }
        notifySaved("Zapisano raport.");
        closeWizard({ clearDraft: true });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nieznany błąd");
      }
    });
  };

  if (!isOpen) {
    return (
      <div className="theme-black-gold overflow-hidden rounded-3xl border border-white/10 bg-[#141416]/90 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d4af37]/80">
              Nowy raport
            </p>
            <p className="mt-1 text-sm text-white/60">
              Pomiary, samopoczucie, zgodność z planem i zdjęcia — krok po kroku.
            </p>
          </div>
          <GoldButton
            onClick={() => openWizard({ restoreDraft: true })}
            className="w-full sm:w-auto"
          >
            Dodaj raport
          </GoldButton>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-black-gold overflow-hidden rounded-3xl border border-white/[0.08] bg-[#161618] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[#d4af37]" aria-hidden />
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/85">
            Nowy raport
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dueLabel ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d4af37]">
              {dueLabel}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => closeWizard({ clearDraft: true })}
            className="text-[11px] font-medium uppercase tracking-wide text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
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
            />
            <div className="grid grid-cols-2 gap-3">
              <MeasureInput id="waistCm" label="Pas (cm)" value={waistCm} onChange={setWaistCm} />
              <MeasureInput id="thighCm" label="Udo (cm)" value={thighCm} onChange={setThighCm} />
              <MeasureInput id="chestCm" label="Klatka (cm)" value={chestCm} onChange={setChestCm} />
              <MeasureInput id="armCm" label="Ramię (cm)" value={armCm} onChange={setArmCm} />
            </div>
            <MeasureInput
              id="abdomenCm"
              label="Brzuch (cm)"
              value={abdomenCm}
              onChange={setAbdomenCm}
            />
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
            />
            <ScoreBars
              label="Energia treningu"
              value={trainingEnergy}
              onChange={setTrainingEnergy}
              invalid={Boolean(fieldError) && trainingEnergy == null}
            />
            <ScoreBars
              label="Trawienie"
              value={digestionScore}
              onChange={setDigestionScore}
              invalid={Boolean(fieldError) && digestionScore == null}
            />
            <ScoreBars
              label="Sen"
              value={sleepQuality}
              onChange={setSleepQuality}
              invalid={Boolean(fieldError) && sleepQuality == null}
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
            />
            <TakNieToggle
              label="Dieta"
              value={dietCompliance}
              onChange={setDietCompliance}
              invalid={Boolean(fieldError) && !dietCompliance}
            />
            <TakNieToggle
              label="Treningi"
              value={trainingCompliance}
              onChange={setTrainingCompliance}
              invalid={Boolean(fieldError) && !trainingCompliance}
            />
          </div>
          {cardioCompliance === "nie" ||
          dietCompliance === "nie" ||
          trainingCompliance === "nie" ? (
            <div className="mt-5">
              <FieldLabel required>Czego nie udało się zrealizować i w jakim zakresie?</FieldLabel>
              <textarea
                rows={3}
                value={complianceNotes}
                onChange={(e) => setComplianceNotes(e.target.value)}
                placeholder="np. cardio 1× zamiast 2×, delegacja w tygodniu"
                className="w-full resize-y rounded-xl border border-[#d4af37]/22 bg-black/45 px-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus-visible:border-[#d4af37]/55 focus-visible:ring-2 focus-visible:ring-[#d4af37]/25"
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
            subtitle="Prywatne, widzę je tylko ja."
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
          <p className="mt-3 text-center text-xs italic text-white/45">
            „Przód” napędza slider Twojej przemiany.
          </p>
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
          <ul className="mt-5 space-y-2 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white/75">
            <li>
              Waga:{" "}
              <span className="font-semibold text-[#d4af37]">
                {parseDecimal(weightKg) ?? "—"} kg
              </span>
            </li>
            <li>
              Pas / udo / klatka / ramię:{" "}
              {[waistCm, thighCm, chestCm, armCm]
                .map((v) => (parseDecimal(v) != null ? `${parseDecimal(v)}` : "—"))
                .join(" / ")}{" "}
              cm
            </li>
            <li>
              Samopoczucie: dzień {dayEnergy}/10 · trening {trainingEnergy}/10 · trawienie{" "}
              {digestionScore}/10 · sen {sleepQuality}/10
            </li>
            <li>
              Plan: cardio {cardioCompliance.toUpperCase()} · dieta {dietCompliance.toUpperCase()} ·
              treningi {trainingCompliance.toUpperCase()}
            </li>
            <li>
              Zdjęcia:{" "}
              {PHOTO_SLOTS.filter((s) => slotPhotos[s.key]).map((s) => s.label).join(", ") ||
                "brak"}
            </li>
          </ul>
          <div className="mt-4">
            <FieldLabel>Informacje dodatkowe</FieldLabel>
            <textarea
              rows={3}
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder="Opcjonalnie…"
              className="w-full resize-y rounded-xl border border-[#d4af37]/22 bg-black/45 px-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus-visible:border-[#d4af37]/55 focus-visible:ring-2 focus-visible:ring-[#d4af37]/25"
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
  );
}
