import { logCardioFormAction } from "@/actions/workout";
import { SubmitButton } from "@/components/home/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

export function QuickLogCardio() {
  return (
    <div className="glass-panel p-6">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
        Zapisz sesję
      </p>
      <h2 className="font-heading mt-1 text-xl font-semibold">
        Dodaj minuty cardio
      </h2>
      <p className="mt-1 text-sm text-white/60">
        Zapisuje w Turso i aktualizuje kroczącą sumę z 7 dni.
      </p>
      <form className="mt-5 space-y-4" action={logCardioFormAction}>
        <div className="space-y-2">
          <Label htmlFor="title">Opis</Label>
          <Input
            id="title"
            name="title"
            defaultValue="Interwały na bieżni"
            className="border-white/15 bg-black/30"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="minutes">Minuty cardio</Label>
          <Input
            id="minutes"
            name="minutes"
            type="number"
            min={0}
            defaultValue={20}
            className="border-white/15 bg-black/30"
          />
        </div>
        <SubmitButton className="w-full bg-[var(--neon)] text-white hover:bg-[#ff4d6d]">
          <Plus className="mr-2 h-4 w-4" />
          Zapisz do bazy
        </SubmitButton>
      </form>
    </div>
  );
}
