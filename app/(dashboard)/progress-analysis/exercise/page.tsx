import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getExerciseProgressSeries } from "@/lib/exercise-progress";
import { projectE1rmForecast } from "@/lib/progress-forecast";
import { ScreenHeader } from "@/components/layout/screen";
import { ExerciseDetailCharts } from "@/components/progress-analysis/exercise-detail-charts";

export default async function ExerciseDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const { q } = await searchParams;
  const query = (q ?? "").trim();
  if (!query) notFound();

  const data = await getExerciseProgressSeries({
    userId,
    exerciseQuery: query,
    days: 365,
  });
  const forecast = projectE1rmForecast(data.points, 28);

  return (
    <div className="space-y-8">
      <ScreenHeader
        kicker="Ćwiczenie"
        title={data.matchedExerciseNames[0] ?? query}
        description={
          <>
            Historia e1RM, tonaż, rekordy oraz prognoza na 28 dni (regresja liniowa).
            {data.matchedExerciseNames.length > 1 ? (
              <>
                {" "}
                Dopasowania: {data.matchedExerciseNames.slice(0, 4).join(", ")}
              </>
            ) : null}
          </>
        }
        actions={
          <Link
            href="/progress-analysis"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-4 text-sm font-medium text-white/85 hover:bg-white/10"
          >
            Wróć do analizy
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="glass-panel p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Max e1RM</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data.prs.maxE1rm.value || "—"}</p>
          <p className="mt-1 text-xs text-white/45">{data.prs.maxE1rm.date ?? "—"}</p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Max ciężar</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data.prs.maxWeight.value || "—"}</p>
          <p className="mt-1 text-xs text-white/45">{data.prs.maxWeight.date ?? "—"}</p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Prognoza e1RM / 28 dni</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {forecast.in28Days != null ? forecast.in28Days : "—"}
          </p>
          <p className="mt-1 text-xs text-white/45">
            {forecast.slopePerDay != null
              ? `Trend: ${forecast.slopePerDay > 0 ? "+" : ""}${forecast.slopePerDay} kg/dzień`
              : "Za mało punktów (min. 3)"}
          </p>
        </div>
      </section>

      <ExerciseDetailCharts points={data.points} forecast={forecast.forecast} />
    </div>
  );
}
