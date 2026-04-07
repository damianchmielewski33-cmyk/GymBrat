import { auth } from "@/auth";
import { ReportsCharts } from "@/components/reports/reports-charts";
import { StatCard } from "@/components/reports/stat-card";
import { getReportsData } from "@/lib/reports";
import {
  Activity,
  CalendarDays,
  Clock,
  Flame,
  Target,
} from "lucide-react";

function fmtMinutes(m: number) {
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return min ? `${h}h ${min}m` : `${h}h`;
}

export default async function ReportsPage() {
  const session = await auth();
  const userId = session!.user!.id;
  const data = await getReportsData(userId);
  const { stats, dailyCardio, weeklySessions, sessions } = data;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
          Dziennik treningów
        </p>
        <h1 className="font-heading metallic-text mt-2 text-3xl font-semibold">
          Raporty
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/65">
          Historia i podsumowania z Turso — trendy cardio, częstotliwość sesji
          i ostatnie wpisy.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={Activity}
          label="Łącznie sesji"
          value={String(stats.totalSessions)}
          hint="Od początku"
        />
        <StatCard
          icon={Flame}
          label="Cardio (łącznie)"
          value={fmtMinutes(stats.totalCardioAll)}
          hint="Suma zapisanych minut"
        />
        <StatCard
          icon={CalendarDays}
          label="Ostatnie 30 dni"
          value={fmtMinutes(stats.cardioLast30Days)}
          hint="Minuty cardio"
        />
        <StatCard
          icon={Target}
          label="Ten tydzień"
          value={`${Math.round(stats.weeklyCardioMinutes)} / ${stats.weeklyCardioGoal} min`}
          hint={`${stats.weeklyCardioPercent}% tygodniowego celu`}
        />
        <StatCard
          icon={Clock}
          label="Śr. czas"
          value={
            stats.avgDurationMinutes != null
              ? `${stats.avgDurationMinutes} min`
              : "—"
          }
          hint="Gdy jest start i koniec"
        />
      </div>

      <ReportsCharts dailyCardio={dailyCardio} weeklySessions={weeklySessions} />

      <div className="glass-panel neon-glow overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
            Historia
          </p>
          <h2 className="font-heading mt-1 text-lg font-semibold text-white">
            Ostatnie sesje
          </h2>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[1.4fr_0.55fr_0.45fr_0.45fr] gap-4 border-b border-white/10 px-6 py-3 text-xs uppercase tracking-wide text-white/45">
              <span>Sesja</span>
              <span>Kiedy</span>
              <span className="text-right">Czas</span>
              <span className="text-right">Cardio</span>
            </div>
            <ul>
              {sessions.length === 0 ? (
                <li className="px-6 py-12 text-center text-sm text-white/55">
                  Brak sesji — dodaj cardio na stronie Start albo zakończ trening.
                </li>
              ) : (
                sessions.map((r) => (
                  <li
                    key={r.id}
                    className="grid grid-cols-[1.4fr_0.55fr_0.45fr_0.45fr] items-center gap-4 border-b border-white/5 px-6 py-4 text-sm last:border-0"
                  >
                    <span className="flex items-center gap-2 font-medium text-white/90">
                      <Activity className="h-4 w-4 shrink-0 text-[var(--neon)]" />
                      <span className="truncate">{r.title}</span>
                    </span>
                    <span className="text-white/60">
                      {r.startedAt.toLocaleString()}
                    </span>
                    <span className="text-right tabular-nums text-white/75">
                      {r.durationMinutes != null
                        ? `${r.durationMinutes} min`
                        : "—"}
                    </span>
                    <span className="text-right tabular-nums text-white/80">
                      {r.cardioMinutes}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
