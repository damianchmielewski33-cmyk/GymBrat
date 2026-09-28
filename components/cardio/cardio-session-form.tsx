"use client";

import { useActionState, useEffect, useState } from "react";
import { logCardioFormAction } from "@/actions/workout";
import { SubmitButton } from "@/components/home/submit-button";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { CARDIO_MACHINES } from "@/lib/cardio-machines";
import { GpsTracker } from "@/components/cardio/gps-tracker";
import type { GpsPoint } from "@/lib/cardio-machines";

export function CardioSessionForm() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, formAction] = useActionState(logCardioFormAction, {} as {
    ok?: boolean;
    error?: string;
  });
  const [machine, setMachine] = useState("treadmill");
  const [distanceKm, setDistanceKm] = useState("");
  const [routeJson, setRouteJson] = useState("[]");
  const showGps = machine === "outdoor_run" || machine === "outdoor_walk";

  useEffect(() => {
    if (state?.ok === true) notifySaved("Zapisano sesję cardio.");
    else if (state?.ok === false && state.error) notifyError("Nie udało się zapisać sesji.");
  }, [state, notifySaved, notifyError]);

  function onGpsUpdate(points: GpsPoint[], km: number) {
    setRouteJson(JSON.stringify(points));
    if (km > 0) setDistanceKm(String(km));
  }

  return (
    <div className="glass-panel p-6">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
        Zapisz sesję
      </p>
      <h2 className="font-heading mt-1 text-xl font-semibold">Cardio</h2>
      <p className="mt-1 text-sm text-white/60">
        Maszyna, dystans i opcjonalna trasa GPS — trafia do tygodniowego celu.
      </p>
      <form className="mt-5 space-y-4" action={formAction}>
        <input type="hidden" name="machineId" value={machine} />
        <input type="hidden" name="distanceKm" value={distanceKm} />
        <input type="hidden" name="routeJson" value={routeJson} />

        <div className="space-y-2">
          <Label htmlFor="machine">Maszyna / aktywność</Label>
          <select
            id="machine"
            value={machine}
            onChange={(e) => setMachine(e.target.value)}
            className="flex h-11 w-full rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white outline-none"
          >
            {CARDIO_MACHINES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Opis</Label>
          <Input
            id="title"
            name="title"
            defaultValue="Sesja cardio"
            className="border-white/15 bg-black/30"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="minutes">Minuty</Label>
            <Input
              id="minutes"
              name="minutes"
              type="number"
              min={0}
              defaultValue={20}
              className="border-white/15 bg-black/30"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="distance">Dystans (km)</Label>
            <Input
              id="distance"
              type="number"
              step="0.01"
              min={0}
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              className="border-white/15 bg-black/30"
            />
          </div>
        </div>

        {showGps ? <GpsTracker onUpdate={onGpsUpdate} /> : null}

        <SubmitButton className="w-full bg-[var(--neon)] text-white hover:bg-[#ff4d6d]">
          <Plus className="mr-2 h-4 w-4" />
          Zapisz sesję
        </SubmitButton>
      </form>
    </div>
  );
}
