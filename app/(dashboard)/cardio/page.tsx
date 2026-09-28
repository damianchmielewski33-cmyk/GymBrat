import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ScreenHeader } from "@/components/layout/screen";
import { CardioSessionForm } from "@/components/cardio/cardio-session-form";
import { StoriesStrip } from "@/components/cardio/stories-strip";
import { listActiveStories } from "@/actions/stories";
import { getWeeklyCardioProgress } from "@/lib/cardio";
import Link from "next/link";

export default async function CardioPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [stories, weekly] = await Promise.all([
    listActiveStories(),
    getWeeklyCardioProgress(session.user.id),
  ]);

  return (
    <div className="space-y-8">
      <ScreenHeader
        kicker="Kondycja"
        title="Cardio"
        description={
          <>
            Maszyny, GPS outdoor i stories (24 h). W tym tygodniu:{" "}
            <span className="font-semibold text-white">
              {weekly.minutesCompleted} / {weekly.weeklyGoal} min
            </span>{" "}
            ({weekly.percent}%).
          </>
        }
      />

      <StoriesStrip stories={stories} />

      <div className="grid gap-6 lg:grid-cols-2">
        <CardioSessionForm />
        <section className="glass-panel space-y-3 p-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
            Apple Watch
          </p>
          <h2 className="font-heading text-lg font-semibold text-white">
            Import z zegarka
          </h2>
          <p className="text-sm leading-relaxed text-white/65">
            GymBrat jako aplikacja webowa <strong className="text-white/85">nie ma bezpośredniego
            dostępu do HealthKit</strong>. Dane z Apple Watch trafiają najpierw do Apple Health na
            iPhonie — dopiero natywna aplikacja iOS (Capacitor / Swift) może je odczytać i wysłać do
            API GymBrat.
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-white/65">
            <li>Zbuduj wrapper iOS (np. Capacitor) wokół tej aplikacji.</li>
            <li>
              W Xcode włącz HealthKit + uprawnienia{" "}
              <code className="text-white/80">HKWorkoutType</code> / dystans / tętno.
            </li>
            <li>
              Po zakończeniu treningu na Watchu odczytaj{" "}
              <code className="text-white/80">HKWorkout</code> i wyślij POST na{" "}
              <code className="text-white/80">/api/workouts/complete</code> lub{" "}
              <code className="text-white/80">logTrainingSession</code> (minuty, dystans, machineId).
            </li>
            <li>
              Alternatywa bez App Store: eksport{" "}
              <code className="text-white/80">.gpx</code> /{" "}
              <code className="text-white/80">Workout.xml</code> z Health i import ręczny (planowane).
            </li>
          </ol>
          <p className="text-xs text-white/45">
            Do czasu natywnego iOS korzystaj z GPS w tej stronie (bieg/marsz) albo wpisz minuty z
            maszyny ręcznie.
          </p>
          <Link
            href="/profile"
            className="inline-flex text-sm font-medium text-[var(--neon)] hover:underline"
          >
            Cel tygodniowy cardio → Profil
          </Link>
        </section>
      </div>
    </div>
  );
}
