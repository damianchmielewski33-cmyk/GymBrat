"use client";

import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/auth-role";
import { ClipboardList, Dumbbell, Lock, Sparkles } from "lucide-react";

type Props = {
  role: AppRole;
  onSelectRole: (role: AppRole) => void;
  /** When true, trener card is visual-only and cannot be selected. */
  trainerLocked: boolean;
  /** Nagłówek nad kartami (np. logowanie vs rejestracja). */
  heading?: string;
};

export function RoleAuthCards({
  role,
  onSelectRole,
  trainerLocked,
  heading = "Logujesz się jako",
}: Props) {
  return (
    <div className="space-y-4">
      <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-white/55">
        {heading}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelectRole("zawodnik")}
          className={cn(
            "group relative min-h-[168px] overflow-hidden rounded-2xl border px-5 py-6 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/40",
            role === "zawodnik"
              ? "border-[var(--neon)]/65 bg-gradient-to-br from-[var(--neon)]/20 via-white/[0.06] to-cyan-500/10 shadow-[0_0_40px_rgba(255,45,85,0.22)]"
              : "border-white/12 bg-black/35 hover:border-white/22 hover:bg-black/45",
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-[var(--neon)]/15 blur-2xl transition-opacity group-hover:opacity-100"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
          />
          <div className="relative flex flex-col gap-4">
            <div
              className={cn(
                "flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border bg-gradient-to-br shadow-inner",
                role === "zawodnik"
                  ? "border-[var(--neon)]/40 from-[var(--neon)]/35 to-black/50 text-white"
                  : "border-white/10 from-white/12 to-black/40 text-white/85",
              )}
            >
              <Dumbbell className="h-10 w-10" strokeWidth={1.5} aria-hidden />
            </div>
            <div>
              <span className="font-heading text-xl font-semibold tracking-tight text-white">
                Zawodnik
              </span>
              <p className="mt-1.5 text-sm leading-snug text-white/55">
                Śledź trening, wartości odżywcze i postępy w jednym miejscu.
              </p>
            </div>
          </div>
          {role === "zawodnik" ? (
            <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-[var(--neon)]/35 bg-black/30 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--neon)]">
              <Sparkles className="h-3 w-3" aria-hidden />
              Wybrane
            </span>
          ) : null}
        </button>

        {trainerLocked ? (
          <div
            className="relative min-h-[168px] cursor-not-allowed overflow-hidden rounded-2xl border border-white/10 bg-black/25 px-5 py-6 text-left opacity-75"
            aria-disabled="true"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-violet-500/8 blur-2xl"
            />
            <div className="relative flex flex-col gap-4">
              <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-black/50 text-white/45">
                <ClipboardList className="h-10 w-10" strokeWidth={1.5} aria-hidden />
              </div>
              <div>
                <span className="font-heading text-xl font-semibold tracking-tight text-white/70">
                  Trener
                </span>
                <p className="mt-1.5 text-sm leading-snug text-white/45">
                  Planuj, analizuj i prowadź zawodników — interfejs pod Ciebie.
                </p>
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-snug text-amber-100/95">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200/90" aria-hidden />
                  <span>
                    Logika konta trenera powstanie w przyszłości — na razie możliwe jest
                    wyłącznie konto zawodnika.
                  </span>
                </p>
              </div>
            </div>
            <span className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/40 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-white/45">
              Wkrótce
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onSelectRole("trener")}
            className={cn(
              "group relative min-h-[168px] overflow-hidden rounded-2xl border px-5 py-6 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/40",
              role === "trener"
                ? "border-[var(--neon)]/65 bg-gradient-to-br from-[var(--neon)]/20 via-white/[0.06] to-violet-500/10 shadow-[0_0_40px_rgba(255,45,85,0.22)]"
                : "border-white/12 bg-black/35 hover:border-white/22 hover:bg-black/45",
            )}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-violet-500/12 blur-2xl transition-opacity group-hover:opacity-100"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
            />
            <div className="relative flex flex-col gap-4">
              <div
                className={cn(
                  "flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border bg-gradient-to-br shadow-inner",
                  role === "trener"
                    ? "border-[var(--neon)]/40 from-[var(--neon)]/35 to-black/50 text-white"
                    : "border-white/10 from-white/12 to-black/40 text-white/85",
                )}
              >
                <ClipboardList className="h-10 w-10" strokeWidth={1.5} aria-hidden />
              </div>
              <div>
                <span className="font-heading text-xl font-semibold tracking-tight text-white">
                  Trener
                </span>
                <p className="mt-1.5 text-sm leading-snug text-white/55">
                  Planuj, analizuj i prowadź zawodników — interfejs pod Ciebie.
                </p>
              </div>
            </div>
            {role === "trener" ? (
              <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-[var(--neon)]/35 bg-black/30 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--neon)]">
                <Sparkles className="h-3 w-3" aria-hidden />
                Wybrane
              </span>
            ) : null}
          </button>
        )}
      </div>
    </div>
  );
}
