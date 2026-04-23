"use client";

import { useMemo, useState } from "react";
import { Disc3 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { breakdownBarbellPlates } from "@/lib/plate-calculator";
import { cn } from "@/lib/utils";

function formatPlateList(plates: number[]): string {
  if (plates.length === 0) return "—";
  const counts = new Map<number, number>();
  for (const p of plates) {
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([kg, n]) => `${n}×${kg}`)
    .join(" + ");
}

export function PlateCalculatorSheet() {
  const [open, setOpen] = useState(false);
  const [targetStr, setTargetStr] = useState("100");
  const [barKg, setBarKg] = useState<20 | 15>(20);

  const breakdown = useMemo(() => {
    const t = Number.parseFloat(targetStr.replace(",", "."));
    return breakdownBarbellPlates({ targetTotalKg: t, barKg });
  }, [targetStr, barKg]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        type="button"
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.12] bg-[#1e1e1e] px-3 py-1.5 text-[11px] font-semibold text-white/85 transition hover:bg-[#262626]",
        )}
        aria-label="Kalkulator talerzy"
      >
        <Disc3 className="h-3.5 w-3.5 text-[#3B82F6]" />
        Talerze
      </SheetTrigger>
      <SheetContent side="bottom" className="border-white/10 bg-[#0a0a0f] text-white">
        <SheetHeader>
          <SheetTitle className="text-white">Kalkulator talerzy</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <div className="grid gap-2">
            <Label className="text-white/75">Docelowy ciężar sztangi (kg)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={targetStr}
              onChange={(e) => setTargetStr(e.target.value)}
              className="h-11 rounded-xl border-white/12 bg-white/[0.06] text-white"
              placeholder="np. 102.5"
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-white/75">Sztanga</Label>
            <div className="flex gap-2">
              {([20, 15] as const).map((kg) => (
                <button
                  key={kg}
                  type="button"
                  onClick={() => setBarKg(kg)}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                    barKg === kg
                      ? "border-[var(--neon)]/50 bg-[var(--neon)]/15 text-white"
                      : "border-white/12 bg-white/[0.04] text-white/70 hover:bg-white/[0.07]",
                  )}
                >
                  {kg} kg
                </button>
              ))}
            </div>
          </div>

          {!breakdown ? (
            <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
              Podaj wartość większą niż masa sztangi (np. 60–350 kg).
            </p>
          ) : (
            <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
                Na stronę (symetrycznie)
              </p>
              <p className="text-sm leading-relaxed text-white/85">
                {formatPlateList(breakdown.left.plates)}
              </p>
              {breakdown.left.remainderKg > 0.02 ? (
                <p className="text-xs text-amber-200/85">
                  Reszta na stronę (poza zestawem): ~{breakdown.left.remainderKg.toFixed(2)} kg — sprawdź,
                  czy masz mniejsze talerze.
                </p>
              ) : null}
              <div className="border-t border-white/[0.06] pt-3 text-xs text-white/55">
                <p>
                  Sztanga {breakdown.barKg} kg + 2×{breakdown.left.sideTotalKg.toFixed(1)} kg talerzy ≈{" "}
                  <span className="font-semibold tabular-nums text-white">
                    {breakdown.achievedTotalKg.toFixed(1)}
                  </span>{" "}
                  kg
                </p>
                {!breakdown.exact ? (
                  <p className="mt-1 text-amber-200/80">
                    Nie da się dokładnie uzyskać {breakdown.targetTotalKg} kg tym zestawem — pokazano
                    najbliższy niżej.
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
