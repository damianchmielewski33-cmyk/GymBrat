"use client";

import { motion } from "framer-motion";
import { ClipboardList } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ActiveSessionCardProps = {
  children: ReactNode;
  hasLoadedPlan: boolean;
  initialPlansEmpty: boolean;
  cardioMinutes: number;
  onCardioChange: (n: number) => void;
  onResetSession: () => void;
};

/**
 * Obudowa sesji: pusty stan lub czarny obszar treningu + cardio i reset.
 */
export function ActiveSessionCard({
  children,
  hasLoadedPlan,
  initialPlansEmpty,
  cardioMinutes,
  onCardioChange,
  onResetSession,
}: ActiveSessionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className={`flex flex-col bg-black ${hasLoadedPlan ? "min-h-0 flex-1 rounded-none border-0 p-0 pb-2 sm:min-h-[min(72vh,820px)]" : "min-h-[min(85vh,880px)] rounded-2xl border border-white/[0.08] p-4 sm:p-5"}`}
      >
        {!hasLoadedPlan ? (
          <>
            <div className="mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                Trening
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-[1.65rem]">
                Aktywny trening
              </h1>
              <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-white/45">
                Wybierz plan po prawej, aby wczytać ćwiczenia w układzie z dziennika treningowego.
              </p>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-5 px-2 py-10 text-center">
              <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-6">
                <ClipboardList className="mx-auto h-11 w-11 text-[#FF9500]" />
              </div>
              <div>
                <p className="text-[17px] font-semibold text-white">Wybierz plan</p>
                <p className="mt-2 max-w-md text-[13px] text-white/45">
                  Po prawej kliknij <span className="text-[#FF9500]">Rozpocznij trening</span>.
                </p>
              </div>
              {initialPlansEmpty ? (
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    href="/workout-plan"
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#FF9500] px-8 text-sm font-bold text-black hover:brightness-110"
                  >
                    Dodaj plan treningowy
                  </Link>
                </motion.div>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto pr-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15">
              {children}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/[0.08] pt-4">
              <label className="text-[11px] text-white/45">Cardio (min)</label>
              <Input
                type="number"
                min={0}
                value={cardioMinutes}
                onChange={(e) => onCardioChange(Number(e.target.value))}
                className="h-10 w-24 rounded-xl border-white/[0.1] bg-[#141414] text-center text-white"
              />
              <Button type="button" variant="outline" size="sm" onClick={onResetSession}>
                Resetuj sesję
              </Button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
