"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Pencil, X } from "lucide-react";

type Ctx = { editing: boolean; finish: () => void };
const EditGateCtx = createContext<Ctx | null>(null);

/** Formularz wywołuje `finish()` po udanym zapisie, by wrócić do odczytu. */
export function useEditGate(): Ctx | null {
  return useContext(EditGateCtx);
}

/** Przycisk zapisu widoczny tylko w trybie edycji (CSS w globals.css). */
export function EditOnly({ children }: { children: ReactNode }) {
  return <div data-edit-only>{children}</div>;
}

/**
 * Pola są tylko do odczytu, dopóki użytkownik nie kliknie „Edytuj”.
 * „Anuluj” przywraca wartości z serwera (remount dzieci).
 */
export function EditGate({
  children,
  label = "Edytuj",
  onCancel,
}: {
  children: ReactNode;
  label?: string;
  /** Wywołane przy „Anuluj” — dla stanu trzymanego poza dziećmi. */
  onCancel?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [version, setVersion] = useState(0);
  const finish = useCallback(() => setEditing(false), []);
  const cancel = useCallback(() => {
    setEditing(false);
    setVersion((v) => v + 1);
    onCancel?.();
  }, [onCancel]);
  const ctx = useMemo(() => ({ editing, finish }), [editing, finish]);

  return (
    <EditGateCtx.Provider value={ctx}>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-white/50" aria-live="polite">
            {editing ? "Tryb edycji" : "Tylko do odczytu"}
          </p>
          {editing ? (
            <button
              type="button"
              onClick={cancel}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/15 px-3.5 text-[13px] font-semibold text-white/80 transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50"
            >
              <X className="h-4 w-4" aria-hidden />
              Anuluj
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/10 px-3.5 text-[13px] font-semibold text-[var(--gym-gold)] transition-colors hover:bg-[var(--gym-gold)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50"
            >
              <Pencil className="h-4 w-4" aria-hidden />
              {label}
            </button>
          )}
        </div>
        <fieldset
          disabled={!editing}
          className="profile-gate m-0 min-w-0 border-0 p-0"
        >
          <div key={version}>{children}</div>
        </fieldset>
      </div>
    </EditGateCtx.Provider>
  );
}
