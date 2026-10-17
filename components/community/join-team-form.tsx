"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { joinTeamByCodeAction, type TeamActionState } from "@/actions/teams";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { screenInputClass } from "@/components/layout/screen";
import { cn } from "@/lib/utils";

export function JoinTeamForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, formAction, pending] = useActionState(
    joinTeamByCodeAction,
    {} as TeamActionState,
  );

  useEffect(() => {
    if (state.error) notifyError(state.error);
    if (state.ok && state.teamId) {
      notifySaved("Dołączono do grupy");
      router.push(`/community/teams/${state.teamId}`);
    }
  }, [state, notifyError, notifySaved, router]);

  return (
    <form action={formAction} className="app-card space-y-4 p-5 sm:p-6">
      <div className="space-y-2">
        <Label htmlFor="code">Kod zaproszenia</Label>
        <Input
          id="code"
          name="code"
          required
          defaultValue={initialCode}
          placeholder="np. BRAT7K2M"
          autoCapitalize="characters"
          className={cn(screenInputClass, "font-mono tracking-[0.2em] uppercase")}
        />
      </div>
      <Button type="submit" variant="cta" className="w-full" disabled={pending}>
        {pending ? "Dołączanie…" : "Dołącz do grupy"}
      </Button>
    </form>
  );
}
