import { Sparkles } from "lucide-react";
import { getDailyBriefingText } from "@/lib/daily-briefing";
import { isAiConfigured } from "@/ai/client";

export async function DailyBriefingCard({ userId }: { userId: string }) {
  const text = await getDailyBriefingText(userId);
  const aiEnabled = isAiConfigured();

  return (
    <section className="glass-panel neon-glow relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(720px_280px_at_10%_0%,rgba(255,45,85,0.14),transparent_58%)]" />
      <div className="relative flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--neon)]/35 bg-[var(--neon)]/10">
          <Sparkles className="h-5 w-5 text-[var(--neon)]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
            Briefing dnia
          </p>
          <p className="text-sm leading-relaxed text-white/80">{text}</p>
          {!aiEnabled ? (
            <p className="text-xs text-white/40">
              Włącz AI (np. lokalnie: <span className="font-mono">AI_PROVIDER=ollama</span>), aby dostać spersonalizowany tekst od modelu.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
