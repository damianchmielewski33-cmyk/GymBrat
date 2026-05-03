import { MessageCircle, Sparkles } from "lucide-react";
import { getDailyBriefing, type DailyBriefingPrefetch } from "@/lib/daily-briefing";
import { isAiConfigured } from "@/ai/client";

export async function DailyBriefingCard({
  userId,
  briefingPrefetch,
}: {
  userId: string;
  /** Z `page.tsx` Start — ten sam kontekst co reszta strony, bez duplikacji zapytań. */
  briefingPrefetch?: DailyBriefingPrefetch;
}) {
  const { text, source, aiDisabledByUser, aiUnavailable } = await getDailyBriefing(
    userId,
    briefingPrefetch,
  );
  const aiConfigured = isAiConfigured();
  const fromModel = source === "ai";

  return (
    <section className="glass-panel neon-glow relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(720px_280px_at_10%_0%,rgba(255,45,85,0.14),transparent_58%)]" />
      <div className="relative flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--neon)]/35 bg-[var(--neon)]/10">
          {fromModel ? (
            <MessageCircle className="h-5 w-5 text-[var(--neon)]" aria-hidden />
          ) : (
            <Sparkles className="h-5 w-5 text-[var(--neon)]" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">
              Trener AI
            </p>
            <p className="font-heading text-lg font-semibold leading-tight text-white">
              Briefing dnia
            </p>
            <p className="mt-1 text-xs text-white/45">
              {fromModel
                ? "Krótka wiadomość od tego samego coacha co w czacie — na podstawie Twoich danych w aplikacji."
                : aiDisabledByUser
                  ? "Wyłączyłeś funkcje AI w profilu — poniżej skrót z Twoich danych (bez modelu)."
                  : aiUnavailable
                    ? "Integracja z modelem nie powiodła się — poniżej skrót z Twoich danych; na końcu treści dopisano „AI niedostępny”."
                    : "Krótkie podsumowanie z Twoich liczb w aplikacji. Włącz dostawcę AI, aby dostać pełny, narracyjny briefing od modelu."}
            </p>
          </div>

          <div
            className={
              fromModel
                ? "rounded-2xl border border-[var(--neon)]/25 bg-black/35 px-4 py-3 text-sm leading-relaxed text-white/85"
                : "rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-white/80"
            }
          >
            {text}
          </div>

          {!aiConfigured && !aiDisabledByUser ? (
            <p className="pt-0.5 text-[11px] text-white/35">
              Lokalnie: ustaw np.{" "}
              <span className="font-mono text-white/50">AI_PROVIDER=ollama</span>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
