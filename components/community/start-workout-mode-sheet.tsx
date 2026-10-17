"use client";

import { useEffect, useState } from "react";
import { Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { GroupTeamOption } from "@/lib/community/group-workout-types";
import { cn } from "@/lib/utils";

export function StartWorkoutModeSheet({
  open,
  onOpenChange,
  teams,
  onSolo,
  onGroup,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: GroupTeamOption[];
  onSolo: () => void;
  onGroup: (teamId: string) => void;
  loading?: boolean;
}) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedTeamId(teams[0]?.id ?? null);
  }, [open, teams]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-3xl border-white/10 bg-[#0a0a0b] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-heading text-xl text-white">
            Jak zaczynasz?
          </SheetTitle>
          <p className="text-[13px] text-white/50">
            Ten sam trening GymBrat — solo albo z Team (presence na żywo).
          </p>
        </SheetHeader>

        <div className="mt-4 grid gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onSolo}
            className="flex min-h-[4.25rem] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-left transition-colors hover:border-[var(--gym-gold)]/30 hover:bg-[var(--gym-gold)]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/45 disabled:opacity-50"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/80">
              <User className="h-4 w-4" aria-hidden />
            </span>
            <span>
              <span className="block text-[15px] font-semibold text-white">
                Solo
              </span>
              <span className="mt-0.5 block text-[12px] text-white/45">
                Klasyczny start — bez widżetu grupy
              </span>
            </span>
          </button>

          <div
            className={cn(
              "rounded-2xl border px-4 py-3.5",
              teams.length === 0
                ? "border-white/8 bg-white/[0.02] opacity-60"
                : "border-[var(--gym-gold)]/25 bg-[var(--gym-gold)]/[0.05]",
            )}
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10 text-[var(--gym-gold)]">
                <Users className="h-4 w-4" aria-hidden />
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-white">
                  Trening grupowy
                </span>
                <span className="mt-0.5 block text-[12px] text-white/45">
                  Team widzi Twoje ćwiczenie, serię i progres (&lt;1s)
                </span>
              </span>
            </div>

            {teams.length === 0 ? (
              <p className="mt-3 text-[12px] text-white/40">
                Dołącz do Team w Community, by startować grupowo.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {teams.map((team) => (
                  <label
                    key={team.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5",
                      selectedTeamId === team.id
                        ? "border-[var(--gym-gold)]/40 bg-black/40"
                        : "border-white/8 bg-black/25",
                    )}
                  >
                    <input
                      type="radio"
                      name="team"
                      className="sr-only"
                      checked={selectedTeamId === team.id}
                      onChange={() => setSelectedTeamId(team.id)}
                    />
                    <span className="text-lg" aria-hidden>
                      {team.avatarEmoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">
                        {team.name}
                      </span>
                      <span className="text-[11px] text-white/40">
                        {team.memberCount} członków
                      </span>
                    </span>
                  </label>
                ))}
                <Button
                  type="button"
                  variant="cta"
                  className="w-full"
                  disabled={loading || !selectedTeamId}
                  onClick={() => selectedTeamId && onGroup(selectedTeamId)}
                >
                  {loading ? "Start…" : "Start z Team"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
