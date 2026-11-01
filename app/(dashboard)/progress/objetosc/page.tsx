import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { withDbRetry } from "@/db/with-retry";
import {
  EmptyNote,
  Meter,
  ProgressSection,
  Surface,
} from "@/components/progress/progress-ui";
import {
  WEEKLY_SET_TARGETS,
  muscleRecoveryState,
  pushPullBalance,
  volumeStatus,
  type MuscleRecoveryState,
  type VolumeStatus,
} from "@/lib/analytics/volume-landmarks";
import { calendarDateKey } from "@/lib/local-date";
import { getProgressHubData } from "@/lib/progress-hub";

const STATUS_LABEL: Record<VolumeStatus, string> = {
  none: "brak serii",
  below: "poniżej zakresu",
  ok: "w zakresie",
  above: "powyżej zakresu",
};

const STATUS_BAR: Record<VolumeStatus, string> = {
  none: "bg-white/20",
  below: "bg-amber-400",
  ok: "bg-[var(--gym-success)]",
  above: "bg-rose-400",
};

const RECOVERY_LABEL: Record<MuscleRecoveryState, string> = {
  never: "brak historii",
  recovering: "regeneruje się",
  ready: "gotowa",
  rested: "wypoczęta",
};

const ACWR_LABEL = {
  unknown: "",
  detraining: "obciążenie spada",
  optimal: "obciążenie stabilne",
  high: "obciążenie rośnie szybko",
  spike: "skok obciążenia — uważaj",
} as const;

const PUSH_PULL_LABEL = {
  balanced: "Pchanie i ciągnięcie są zbalansowane.",
  push_heavy: "Więcej pchania niż ciągnięcia — dodaj serie pleców/tyłu barków.",
  pull_heavy: "Więcej ciągnięcia niż pchania.",
  insufficient: "Za mało danych z 30 dni, by ocenić balans.",
} as const;

export default async function ProgressVolumePage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?callbackUrl=/progress/objetosc");

  const data = await withDbRetry(() => getProgressHubData(userId, "sila"), {
    attempts: 3,
    label: "progress-volume",
  });
  const today = calendarDateKey();
  const rows = data.intelligence.muscle.groups;
  const pushPull = pushPullBalance(rows);
  const bodyKg = data.body.weights.at(-1)?.kg ?? null;
  const lifts = data.strength.maxes
    .filter((m) => m.kind === "weighted" && m.bestE1rm > 0)
    .slice(0, 6);
  const hasAny = rows.some((r) => r.week.sets > 0 || r.days30.sets > 0);

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 pb-8">
      <header className="px-0.5">
        <Link
          href="/progress?tab=sila"
          className="inline-flex items-center gap-1 text-[12px] text-white/55"
        >
          <ArrowLeft className="size-3.5" /> Analiza
        </Link>
        <h1 className="mt-1 font-heading text-[28px] font-semibold leading-8 tracking-tight text-white">
          Objętość tygodniowa
        </h1>
        <p className="mt-1 text-[12px] text-white/55">
          Serie efektywne (do 4 powt. w zapasie, bez rozgrzewek) z ostatnich 7
          dni. Zakresy są orientacyjne.
        </p>
      </header>

      {!hasAny ? (
        <EmptyNote>Zaloguj kilka treningów, a pokażemy objętość na mięsień.</EmptyNote>
      ) : (
        <ProgressSection title="Mięśnie">
          <Surface variant="list">
            {rows.map((r) => {
              const t = WEEKLY_SET_TARGETS[r.id];
              const sets = r.week.effectiveSets;
              const status = volumeStatus(r.id, sets);
              const rec = muscleRecoveryState(r.lastTrainedDate, today);
              return (
                <div key={r.id} className="space-y-1.5 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[15px] font-semibold text-white">{r.label}</p>
                    <p className="text-[13px] tabular-nums text-white/80">
                      {sets} / {t.min}–{t.max} serii
                    </p>
                  </div>
                  <Meter
                    pct={Math.min(100, (sets / t.max) * 100)}
                    className="h-1.5"
                    barClassName={STATUS_BAR[status]}
                  />
                  <p className="text-[12px] text-[var(--gym-text-secondary)]">
                    {STATUS_LABEL[status]} · {RECOVERY_LABEL[rec.state]}
                    {rec.daysSince != null ? ` (${rec.daysSince} dni temu)` : ""}
                  </p>
                  {r.acuteChronic.ratio != null ? (
                    <p className="text-[11px] tabular-nums text-white/45">
                      Ostre/przewlekłe {r.acuteChronic.ratio} ·{" "}
                      {ACWR_LABEL[r.acuteChronic.band]}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </Surface>
        </ProgressSection>
      )}

      <ProgressSection title="Pchanie vs ciągnięcie" trailing="30 dni">
        <Surface>
          <p className="text-[13px] text-white/85">
            {PUSH_PULL_LABEL[pushPull.status]}
          </p>
          {pushPull.ratio != null ? (
            <p className="mt-1 text-[12px] tabular-nums text-white/55">
              Pchanie {pushPull.pushSets} · ciągnięcie {pushPull.pullSets} (
              {pushPull.ratio}:1)
            </p>
          ) : null}
        </Surface>
      </ProgressSection>

      <ProgressSection title="Siła względna" trailing="e1RM / masa ciała">
        {bodyKg && lifts.length > 0 ? (
          <Surface variant="list">
            {lifts.map((l) => (
              <div key={l.name} className="flex justify-between py-2.5 text-[14px]">
                <span className="text-white">{l.name}</span>
                <span className="tabular-nums text-white/80">
                  {(l.bestE1rm / bodyKg).toFixed(2)}× ({Math.round(l.bestE1rm)} kg)
                </span>
              </div>
            ))}
          </Surface>
        ) : (
          <EmptyNote>Dodaj wagę ciała i ćwiczenia z obciążeniem.</EmptyNote>
        )}
      </ProgressSection>
    </div>
  );
}
