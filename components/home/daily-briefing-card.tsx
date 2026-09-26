import { Sparkles } from "lucide-react";
import { getDailyBriefing, type DailyBriefingPrefetch } from "@/lib/daily-briefing";

export async function DailyBriefingCard({
  userId,
  briefingPrefetch,
}: {
  userId: string;
  briefingPrefetch?: DailyBriefingPrefetch;
}) {
  const { text } = await getDailyBriefing(userId, briefingPrefetch);

  return (
    <section className="glass-panel neon-glow relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(720px_280px_at_10%_0%,rgba(255,45,85,0.14),transparent_58%)]" />
      <div className="relative flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--neon)]/35 bg-[var(--neon)]/10">
          <Sparkles className="h-5 w-5 text-[var(--neon)]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">
              Twój dzień
            </p>
            <p className="font-heading text-lg font-semibold leading-tight text-white">
              Briefing dnia
            </p>
            <p className="mt-1 text-xs text-white/45">
              Skrót z Twoich danych w aplikacji — treningi, makro i postępy.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-white/80">
            <div className="whitespace-pre-line">{text}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
