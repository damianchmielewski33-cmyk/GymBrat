"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  archiveTeamAction,
  updateTeamSettingsAction,
  type TeamActionState,
} from "@/actions/teams";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { screenInputClass } from "@/components/layout/screen";
import type { TeamDetailView } from "@/lib/community/teams";
import { cn } from "@/lib/utils";

export function TeamSettingsForm({ team }: { team: TeamDetailView }) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, formAction, pending] = useActionState(
    updateTeamSettingsAction,
    {} as TeamActionState,
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveTeamAction,
    {} as TeamActionState,
  );

  useEffect(() => {
    if (state.error) notifyError(state.error);
    if (state.ok) notifySaved("Zapisano ustawienia grupy");
  }, [state, notifyError, notifySaved]);

  useEffect(() => {
    if (archiveState.error) notifyError(archiveState.error);
    if (archiveState.ok) {
      notifySaved("Grupa zarchiwizowana");
      router.push("/community/teams");
    }
  }, [archiveState, notifyError, notifySaved, router]);

  return (
    <div className="space-y-5">
      <form action={formAction} className="app-card space-y-4 p-5 sm:p-6">
        <input type="hidden" name="teamId" value={team.id} />
        <div className="space-y-2">
          <Label htmlFor="name">Nazwa</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={team.name}
            className={cn(screenInputClass)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Opis</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={team.description}
            rows={3}
            className={cn(screenInputClass, "min-h-[88px]")}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="avatarEmoji">Avatar</Label>
            <Input
              id="avatarEmoji"
              name="avatarEmoji"
              defaultValue={team.avatarEmoji}
              className={cn(screenInputClass, "text-center text-xl")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bannerColor">Banner</Label>
            <Input
              id="bannerColor"
              name="bannerColor"
              type="color"
              defaultValue={team.bannerColor}
              className="h-11 w-full cursor-pointer rounded-2xl border border-white/20 bg-black/50 p-1"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="privacy">Widoczność</Label>
          <select
            id="privacy"
            name="privacy"
            defaultValue={team.privacy}
            className={cn(
              screenInputClass,
              "flex w-full rounded-2xl border px-3 text-sm",
            )}
          >
            <option value="public">Publiczna</option>
            <option value="private">Prywatna</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rankingMetric">Metryka rankingu</Label>
          <select
            id="rankingMetric"
            name="rankingMetric"
            defaultValue={team.rankingMetric}
            className={cn(
              screenInputClass,
              "flex w-full rounded-2xl border px-3 text-sm",
            )}
          >
            <option value="sessions">Sesje / tydzień</option>
            <option value="tonnage">Tonaż / tydzień</option>
            <option value="cardio">Cardio min / tydzień</option>
          </select>
        </div>
        <Button type="submit" variant="cta" className="w-full" disabled={pending}>
          {pending ? "Zapisywanie…" : "Zapisz"}
        </Button>
      </form>

      {team.myRole === "owner" ? (
        <form
          action={archiveAction}
          className="app-card space-y-3 border-red-500/20 p-5"
          onSubmit={(e) => {
            if (
              !window.confirm(
                "Zarchiwizować grupę? Członkowie stracą do niej dostęp.",
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="teamId" value={team.id} />
          <p className="text-sm font-semibold text-red-300">Strefa właściciela</p>
          <p className="text-[13px] text-white/45">
            Archiwizacja ukrywa grupę i blokuje nowe dołączenia.
          </p>
          <Button
            type="submit"
            variant="destructive"
            className="w-full"
            disabled={archivePending}
          >
            {archivePending ? "Archiwizacja…" : "Zarchiwizuj grupę"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
