"use client";

import { useActionState, useEffect } from "react";
import { createStoryAction, type CardioStory } from "@/actions/stories";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/home/submit-button";

export function StoriesStrip({ stories }: { stories: CardioStory[] }) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, formAction] = useActionState(createStoryAction, {
    ok: false,
  } as { ok: boolean; error?: string });

  useEffect(() => {
    if (state?.ok) notifySaved("Story opublikowane (24 h).");
    else if (state?.error) notifyError(state.error);
  }, [state, notifySaved, notifyError]);

  return (
    <section className="glass-panel space-y-4 p-5 sm:p-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
          Stories
        </p>
        <h2 className="font-heading mt-1 text-lg font-semibold text-white">
          Szybkie highlighty cardio
        </h2>
        <p className="mt-1 text-sm text-white/55">
          Widoczne u Ciebie przez 24 godziny — idealne po biegu lub maszynie.
        </p>
      </div>

      {stories.length > 0 ? (
        <ul className="flex gap-3 overflow-x-auto pb-1">
          {stories.map((s) => (
            <li
              key={s.id}
              className="min-w-[9.5rem] max-w-[9.5rem] shrink-0 rounded-2xl border border-[#d4af37]/30 bg-gradient-to-b from-[#2a2210] to-black/60 p-3"
            >
              <p className="line-clamp-4 text-xs leading-snug text-white/90">{s.caption}</p>
              <p className="mt-2 text-[10px] text-white/45">
                {s.minutes != null ? `${s.minutes} min` : ""}
                {s.distanceKm != null ? ` · ${s.distanceKm} km` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-white/45">Brak aktywnych stories.</p>
      )}

      <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="caption"
          placeholder="Np. 5 km w deszczu 💪"
          maxLength={200}
          className="h-11 border-white/15 bg-black/30 text-white"
        />
        <Input
          name="minutes"
          type="number"
          placeholder="min"
          className="h-11 w-full border-white/15 bg-black/30 text-white sm:w-24"
        />
        <Input
          name="distanceKm"
          type="number"
          step="0.01"
          placeholder="km"
          className="h-11 w-full border-white/15 bg-black/30 text-white sm:w-24"
        />
        <SubmitButton className="h-11 shrink-0 bg-[var(--neon)] text-white">
          Opublikuj
        </SubmitButton>
      </form>
    </section>
  );
}
