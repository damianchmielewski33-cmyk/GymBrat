"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAiFeaturesDisabledAction } from "@/actions/ai-preferences";
import { Label } from "@/components/ui/label";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Sparkles } from "lucide-react";

export function AiFeaturesSettingsCard({ initialDisabled }: { initialDisabled: boolean }) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [disabled, setDisabled] = useState(initialDisabled);
  const [pending, start] = useTransition();

  useEffect(() => {
    setDisabled(initialDisabled);
  }, [initialDisabled]);

  function setAllAiDisabled(next: boolean) {
    start(async () => {
      const r = await updateAiFeaturesDisabledAction({ disabled: next });
      if (r.ok) {
        setDisabled(next);
        notifySaved(
          next
            ? "Wyłączono funkcje AI. Aplikacja nie wywoła modelu w Twoim imieniu."
            : "Włączono funkcje AI (jeśli dostawca jest skonfigurowany).",
        );
        router.refresh();
      } else {
        notifyError(r.error);
      }
    });
  }

  return (
    <section className="glass-panel relative overflow-hidden p-8">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(720px_300px_at_15%_0%,rgba(255,45,85,0.14),transparent_58%)]" />
      <div className="relative space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
              Prywatność i AI
            </p>
            <h2 className="font-heading mt-2 text-xl font-semibold">Funkcje AI</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/60">
              Gdy zaznaczysz opcję poniżej, GymBrat nie będzie wysyłał treści do modelu AI w Twoim
              imieniu: briefing dnia, czat trenera, podpowiedzi w aktywnym treningu, generowanie planu
              treningowego ani analiza zdjęć — tam, gdzie korzystamy z modelu, zobaczysz komunikaty lub
              prostsze wersje bez sieci neuronowej.
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--neon)]/35 bg-[var(--neon)]/10">
            <Sparkles className="h-5 w-5 text-[var(--neon)]" aria-hidden />
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5">
          <input
            id="ai-features-disabled"
            type="checkbox"
            checked={disabled}
            disabled={pending}
            onChange={(e) => setAllAiDisabled(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-white/30 bg-black/40 text-[var(--neon)] focus-visible:ring-2 focus-visible:ring-[var(--neon)]/50"
          />
          <div className="min-w-0 space-y-1">
            <Label
              htmlFor="ai-features-disabled"
              className="cursor-pointer text-base font-semibold text-white"
            >
              Wyłącz wszystkie funkcje AI
            </Label>
            <p className="text-sm leading-relaxed text-white/55">
              Dotyczy wszystkich modułów korzystających z modelu językowego lub wizyjnego po stronie
              serwera. Możesz to w każdej chwili cofnąć.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
