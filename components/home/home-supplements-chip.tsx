"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { setSupplementTakenAction } from "@/actions/supplements";
import {
  DEFAULT_DIET_SUPPLEMENTS,
  intakeKey,
  supplementSlots,
  type DietSupplement,
} from "@/lib/diet-supplements";
import { cn } from "@/lib/utils";

/** Suplementy na dziś: kafelki do odhaczania przyjęcia (każda godzina = osobne przyjęcie). */
export function HomeSupplementsChip({
  names,
  items,
  taken: takenInitial,
}: {
  /** @deprecated — preferuj `items` */
  names?: string[] | null;
  /** `null`/`undefined` = domyślna lista; `[]` = brak suplementów. */
  items?: DietSupplement[] | null;
  /** Klucze `intakeKey(nazwa, slot)` przyjęte dziś. */
  taken?: string[];
}) {
  const list: DietSupplement[] =
    items != null
      ? items
      : names != null
        ? names.map((n) => ({ name: n.trim() })).filter((s) => s.name)
        : DEFAULT_DIET_SUPPLEMENTS.map((name) => ({ name }));

  const [taken, setTaken] = useState<Set<string>>(
    () => new Set(takenInitial ?? []),
  );
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  function toggle(s: DietSupplement) {
    const slots = supplementSlots(s);
    const next = slots.find((sl) => !taken.has(intakeKey(s.name, sl)));
    // Wszystko przyjęte → dotknięcie cofa ostatnie przyjęcie.
    const slot = next ?? slots[slots.length - 1]!;
    const value = next !== undefined;
    const key = intakeKey(s.name, slot);

    setError(null);
    setTaken((prev) => {
      const n = new Set(prev);
      if (value) n.add(key);
      else n.delete(key);
      return n;
    });
    start(async () => {
      const r = await setSupplementTakenAction(s.name, slot, value).catch(
        () => ({ ok: false as const }),
      );
      if (!r.ok) {
        setTaken((prev) => {
          const n = new Set(prev);
          if (value) n.delete(key);
          else n.add(key);
          return n;
        });
        setError("Nie udało się zapisać. Spróbuj ponownie.");
      }
    });
  }

  const doneCount = list.filter((s) =>
    supplementSlots(s).every((sl) => taken.has(intakeKey(s.name, sl))),
  ).length;

  return (
    <section className="app-card p-4" aria-labelledby="home-supp-h">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="home-supp-h"
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]"
        >
          Suplementy na dziś
        </h2>
        <Link
          href="/supplements"
          className="inline-flex min-h-11 items-center text-[13px] font-semibold text-[var(--gym-gold)]"
        >
          {list.length === 0 ? "Dodaj →" : "Zarządzaj →"}
        </Link>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-white/60">Dodaj suplementy i dawki.</p>
      ) : (
        <>
          <p className="-mt-1.5 mb-2 text-[12px] text-white/60">
            <span className="font-display text-[26px] leading-none text-white">
              {doneCount}/{list.length}
            </span>{" "}
            przyjęte dziś
          </p>
          <ul className="grid grid-cols-2 gap-2">
            {list.map((s) => {
              const slots = supplementSlots(s);
              const takenN = slots.filter((sl) =>
                taken.has(intakeKey(s.name, sl)),
              ).length;
              const done = takenN === slots.length;
              const nextTime = slots.find(
                (sl) => sl && !taken.has(intakeKey(s.name, sl)),
              );
              return (
                <li key={s.name} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => toggle(s)}
                    aria-pressed={done}
                    aria-label={`${s.name}: ${done ? "przyjęte" : "oznacz jako przyjęte"}${
                      slots.length > 1 ? ` (${takenN} z ${slots.length})` : ""
                    }`}
                    className={cn(
                      "gym-tap flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl border px-3 py-1.5 text-left transition-colors",
                      done
                        ? "border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/10"
                        : "border-white/[0.1] bg-black/30 hover:border-[var(--gym-gold)]/40",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px]",
                        done
                          ? "border-[var(--gym-gold)] bg-[var(--gym-gold)] text-black"
                          : "border-[var(--gym-gold)]/50",
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block truncate text-[12px] font-bold",
                          done ? "text-white/70" : "text-white",
                        )}
                      >
                        {s.name}
                      </span>
                      <span className="block truncate text-[10px] text-white/55">
                        {[
                          s.amount,
                          slots.length > 1 ? `${takenN}/${slots.length}` : null,
                          !done && nextTime ? nextTime : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {error ? (
            <p role="alert" className="mt-2 text-[12px] text-state-error">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
