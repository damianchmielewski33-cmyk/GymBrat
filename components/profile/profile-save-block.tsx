"use client";

import {
  createContext,
  useActionState,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { SubmitButton } from "@/components/home/submit-button";
import { cn } from "@/lib/utils";

export type ProfileSaveResult =
  | { ok: true; savedAt?: string }
  | { ok: false; error: string };

type ProfileSaveBlockProps = {
  action: (
    prev: ProfileSaveResult | null,
    formData: FormData,
  ) => Promise<ProfileSaveResult>;
  /** Po zmianie kontrolki wywołuje requestSubmit() (ADR 0006 §5). */
  autoSubmitOnChange?: boolean;
  /** Ukryj przycisk „Zapisz” (np. same przełączniki). */
  hideSubmit?: boolean;
  submitLabel?: string;
  className?: string;
  children: ReactNode;
  onResult?: (result: ProfileSaveResult) => void;
};

const DirtyCtx = createContext<{
  markDirty: () => void;
  autoSubmit: boolean;
  formRef: React.RefObject<HTMLFormElement | null>;
} | null>(null);

export function useProfileSaveDirty() {
  return useContext(DirtyCtx);
}

function formatSavedAt(iso: string | undefined): string {
  if (!iso) return "Zapisano";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Zapisano";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `Zapisano ${hh}:${mm}`;
}

function PendingHint() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return <span className="text-xs text-white/45">Zapisywanie…</span>;
}

/**
 * Wspólna otoczka zapisu profilu: useActionState + status
 * „Zapisano HH:MM” / „Niezapisane zmiany” / błąd / konflikt.
 */
export function ProfileSaveBlock({
  action,
  autoSubmitOnChange = false,
  hideSubmit = false,
  submitLabel = "Zapisz",
  className,
  children,
  onResult,
}: ProfileSaveBlockProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const [state, formAction] = useActionState(action, null as ProfileSaveResult | null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) setDirty(false);
    onResult?.(state);
  }, [state, onResult]);

  const markDirty = useCallback(() => {
    setDirty(true);
    if (autoSubmitOnChange) {
      queueMicrotask(() => formRef.current?.requestSubmit());
    }
  }, [autoSubmitOnChange]);

  const conflict = state && !state.ok && state.error === "conflict";

  return (
    <DirtyCtx.Provider
      value={{ markDirty, autoSubmit: autoSubmitOnChange, formRef }}
    >
      <form
        ref={formRef}
        action={formAction}
        className={cn("space-y-4", className)}
        onChange={() => {
          if (!autoSubmitOnChange) setDirty(true);
        }}
      >
        {children}

        {conflict ? (
          <div
            role="alert"
            className="rounded-xl border border-amber-400/35 bg-amber-400/10 px-4 py-3 text-[13px] leading-relaxed text-amber-100/90"
          >
            Te ustawienia zmieniono z innego urządzenia — wczytaj najnowsze dane.
            <button
              type="button"
              className="mt-2 block text-[13px] font-semibold text-[var(--gym-gold)] underline-offset-2 hover:underline"
              onClick={() => window.location.reload()}
            >
              Odśwież stronę
            </button>
          </div>
        ) : state && !state.ok && state.error ? (
          <p role="alert" className="text-[13px] text-rose-300/90">
            {state.error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {!hideSubmit ? (
            <SubmitButton className="min-w-[8rem]">{submitLabel}</SubmitButton>
          ) : null}
          <PendingHint />
          {state?.ok ? (
            <span className="text-xs text-emerald-300/80">
              {formatSavedAt(state.savedAt)}
            </span>
          ) : dirty && !autoSubmitOnChange ? (
            <span className="text-xs text-white/45">Niezapisane zmiany</span>
          ) : null}
        </div>
      </form>
    </DirtyCtx.Provider>
  );
}
