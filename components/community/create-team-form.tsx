"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createTeamAction, type TeamActionState } from "@/actions/teams";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { screenInputClass } from "@/components/layout/screen";
import { cn } from "@/lib/utils";

export function CreateTeamForm() {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, formAction, pending] = useActionState(
    createTeamAction,
    {} as TeamActionState,
  );

  useEffect(() => {
    if (state.error) notifyError(state.error);
    if (state.ok && state.teamId) {
      notifySaved("Grupa utworzona");
      router.push(`/community/teams/${state.teamId}`);
    }
  }, [state, notifyError, notifySaved, router]);

  return (
    <form action={formAction} className="app-card space-y-5 p-5 sm:p-6">
      <div className="space-y-2">
        <Label htmlFor="name">Nazwa grupy</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={60}
          placeholder="np. Brat Pack Warszawa"
          className={cn(screenInputClass)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Opis</Label>
        <Textarea
          id="description"
          name="description"
          maxLength={500}
          rows={3}
          placeholder="Cel grupy, poziom, rytm treningów…"
          className={cn(screenInputClass, "min-h-[88px]")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="avatarEmoji">Avatar</Label>
          <Input
            id="avatarEmoji"
            name="avatarEmoji"
            defaultValue="🏋️"
            maxLength={8}
            className={cn(screenInputClass, "text-center text-xl")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rankingMetric">Ranking</Label>
          <select
            id="rankingMetric"
            name="rankingMetric"
            defaultValue="sessions"
            className={cn(
              screenInputClass,
              "flex min-h-12 w-full rounded-2xl border px-3",
            )}
          >
            <option value="sessions">Sesje / tydzień</option>
            <option value="tonnage">Tonaż / tydzień</option>
            <option value="cardio">Cardio min / tydzień</option>
          </select>
        </div>
      </div>

      <fieldset className="space-y-2">
        <LegendLike>Widoczność</LegendLike>
        <div className="grid gap-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/30 px-3.5 py-3">
            <input
              type="radio"
              name="privacy"
              value="public"
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-white">
                Publiczna
              </span>
              <span className="mt-0.5 block text-[12px] text-white/45">
                Widoczna w wyszukiwarce — każdy może dołączyć.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/[0.06] px-3.5 py-3">
            <input
              type="radio"
              name="privacy"
              value="private"
              defaultChecked
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-white">
                Prywatna
              </span>
              <span className="mt-0.5 block text-[12px] text-white/45">
                Tylko kod zaproszenia lub e-mail invite.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <Button type="submit" variant="cta" className="w-full" disabled={pending}>
        {pending ? "Tworzenie…" : "Utwórz grupę"}
      </Button>
    </form>
  );
}

function LegendLike({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
      {children}
    </div>
  );
}
