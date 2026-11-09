"use client";

import { useState } from "react";
import { GLOSSARY, type GlossaryKey } from "@/lib/progress-plain";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

/** Przycisk „?” z arkuszem „Co to znaczy?”: proste wyjaśnienie, przykład i szczegóły pod spodem. */
export function HelpHint({ term }: { term: GlossaryKey }) {
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const g = GLOSSARY[term];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Co to znaczy: ${g.title}`}
        className="-m-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center"
      >
        <span
          aria-hidden
          className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full border border-white/25 text-[14px] font-semibold text-[#d9d2c4]"
        >
          ?
        </span>
      </button>
      <Sheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setMore(false);
        }}
      >
        <SheetContent side="bottom" className="gap-4 rounded-t-[26px] px-5 pb-8 pt-4" showCloseButton={false}>
          <div>
            <p className="text-[13px] font-semibold text-[var(--gym-gold)]">Co to znaczy?</p>
            <SheetTitle className="font-heading text-[22px] font-bold leading-7 text-white">{g.title}</SheetTitle>
          </div>
          <SheetDescription className="text-[16px] leading-6 text-white">{g.short}</SheetDescription>
          <div className="rounded-2xl border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] p-3.5">
            <p className="text-[13px] font-semibold text-[var(--gym-gold)]">Przykład</p>
            <p className="mt-1.5 text-[15px] leading-[22px] text-[#d9d2c4]">{g.example}</p>
          </div>
          <button
            type="button"
            aria-expanded={more}
            onClick={() => setMore((v) => !v)}
            className="flex min-h-11 items-center justify-between text-[14px] font-semibold text-[var(--gym-gold-bright)]"
          >
            Jak dokładnie to liczymy
            <span aria-hidden>{more ? "−" : "+"}</span>
          </button>
          {more ? <p className="text-[14px] leading-[21px] text-[var(--gym-text-secondary)]">{g.detail}</p> : null}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="gold-btn min-h-[52px] rounded-2xl text-[16px] font-semibold"
          >
            Rozumiem
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
}
