import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";

type Step = { done: boolean; title: string; hint: string; href: string; cta: string };

export function EmptyAppGuide({
  profileFilled,
  planExists,
  hasWorkoutHistory,
}: {
  profileFilled: boolean;
  planExists: boolean;
  hasWorkoutHistory: boolean;
}) {
  const steps: Step[] = [
    {
      done: profileFilled,
      title: "Profil i cele makro",
      hint: "Uzupełnij wagę, wzrost i dzienne cele — Start policzy postęp.",
      href: "/profile",
      cta: "Profil",
    },
    {
      done: planExists,
      title: "Plan treningowy",
      hint: "Dodaj przynajmniej jeden dzień z ćwiczeniami.",
      href: "/workout-plan",
      cta: "Plan",
    },
    {
      done: hasWorkoutHistory,
      title: "Pierwszy trening",
      hint: "Uruchom sesję, zapisz serie i zakończ — pojawi się na wykresie.",
      href: "/start-workout",
      cta: "Trening",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
      aria-labelledby="empty-app-guide-heading"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">
            Pierwsze kroki
          </p>
          <h2 id="empty-app-guide-heading" className="font-heading mt-1 text-lg font-semibold text-white">
            Ruszaj z GymBrat ({doneCount}/{steps.length})
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Zaznaczamy automatycznie to, co już masz — resztę dokończ w swoim tempie.
          </p>
        </div>
      </div>
      <ol className="mt-4 space-y-3">
        {steps.map((s) => (
          <li
            key={s.href}
            className="flex gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-3 sm:px-4"
          >
            <div className="mt-0.5 shrink-0 text-[var(--neon)]">
              {s.done ? (
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              ) : (
                <Circle className="h-5 w-5 text-white/35" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">{s.title}</p>
              <p className="mt-0.5 text-xs text-white/55">{s.hint}</p>
            </div>
            <Link
              href={s.href}
              className="inline-flex h-9 shrink-0 items-center justify-center self-center rounded-lg border border-white/15 bg-white/[0.06] px-3 text-xs font-semibold text-white/90 transition hover:bg-white/[0.10]"
            >
              {s.cta}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
