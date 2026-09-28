import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  formatCompact,
  getCompletedWorkoutByIdForUser,
} from "@/lib/workout-history";
import { PrintAutoTrigger } from "@/components/workout/print-auto-trigger";

export default async function WorkoutHistoryPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const w = await getCompletedWorkoutByIdForUser(userId, id);
  if (!w) return notFound();

  return (
    <div className="mx-auto max-w-3xl bg-white px-6 py-8 text-black print:px-0 print:py-0">
      <PrintAutoTrigger />
      <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
        <Link href={`/workout-history/${id}`} className="text-sm text-neutral-600 underline">
          Wróć
        </Link>
        <p className="text-sm text-neutral-500">
          Użyj Ctrl+P / Cmd+P → „Zapisz jako PDF”
        </p>
      </div>

      <header className="border-b border-neutral-200 pb-4">
        <p className="text-xs uppercase tracking-widest text-neutral-500">GymBrat</p>
        <h1 className="mt-1 text-2xl font-semibold">{w.title}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {w.date}
          {w.planName ? ` · Plan: ${w.planName}` : ""}
        </p>
        <p className="mt-2 text-sm text-neutral-700">
          Tonaż: {formatCompact(w.volumeKg)} kg · Siła: {formatCompact(w.strengthScore)}
        </p>
      </header>

      <ul className="mt-6 space-y-6">
        {w.exercises.map((ex) => (
          <li key={ex.id}>
            <h2 className="text-lg font-semibold">{ex.name}</h2>
            <p className="text-sm text-neutral-600">
              Tonaż {formatCompact(ex.volumeKg)} kg · best e1RM {formatCompact(ex.bestE1rm)}
            </p>
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="py-1 pr-3">#</th>
                  <th className="py-1 pr-3">Powt.</th>
                  <th className="py-1 pr-3">Kg</th>
                  <th className="py-1 pr-3">e1RM</th>
                </tr>
              </thead>
              <tbody>
                {ex.sets.map((s, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    <td className="py-1 pr-3">{i + 1}</td>
                    <td className="py-1 pr-3">{s.reps ?? "—"}</td>
                    <td className="py-1 pr-3">{s.weight > 0 ? formatCompact(s.weight) : "—"}</td>
                    <td className="py-1 pr-3">{s.e1rm > 0 ? formatCompact(s.e1rm) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </li>
        ))}
      </ul>
    </div>
  );
}
