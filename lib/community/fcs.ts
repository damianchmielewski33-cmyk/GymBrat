/**
 * Fair Competition Score (FCS) — ranking sprawiedliwy 0–100.
 *
 * ─────────────────────────────────────────────────────────────
 * WZÓR
 *   FCS = clamp(0, 100, 100 · Σ_i w_i · c_i  +  newcomerBoost)
 *
 *   c_i ∈ [0, 1] — znormalizowany komponent (względem SIEBIE, nie absolutnych kg)
 *   w_i — wagi (sumują się do 1)
 *
 * WAGI
 *   progress   0.20  — progres obciążenia/objętości vs własny poprzedni tydzień
 *   regularity 0.15  — regularność (sesje/cel + rozkład dni)
 *   plan       0.15  — ukończenie planu / tygodniowego celu sesji
 *   streak     0.10  — streak tygodni z ≥1 treningiem (cap 8 tyg. = 1.0)
 *   challenge  0.10  — udział i postęp w challenge grupy
 *   social     0.10  — aktywność w feedzie (posty, komentarze, reakcje WYSTAWIONE)
 *   help       0.10  — pomoc innym (komentarze/reakcje na CUDZE posty)
 *   live       0.10  — udział w live treningach grupowych
 *
 * ZASADA SPRAWIEDLIWOŚCI
 *   Nie premiujemy samych kilogramów. Nowicjusz z +15% objętości tygodnia
 *   może wyprzedzić zaawansowanego z stagnacją 2000 kg.
 * ─────────────────────────────────────────────────────────────
 */

export const FCS_WEIGHTS = {
  progress: 0.2,
  regularity: 0.15,
  plan: 0.15,
  streak: 0.1,
  challenge: 0.1,
  social: 0.1,
  help: 0.1,
  live: 0.1,
} as const;

export type FcsComponentKey = keyof typeof FCS_WEIGHTS;

export type FcsComponents = Record<FcsComponentKey, number>;

export type FcsBreakdown = {
  components: FcsComponents;
  /** 0–100 przed boostem nowicjusza. */
  raw: number;
  /** 0 lub +5 (gdy kwalifikuje się i ma ≥2 sesje). */
  newcomerBoost: number;
  /** Wynik finalny 0–100. */
  fcs: number;
};

export type FcsInput = {
  /** Sesje w bieżącym tygodniu (unik. dni treningowe też osobno). */
  sessionsThisWeek: number;
  uniqueDaysThisWeek: number;
  /** Cel tygodniowy (z planu / fitness goals). Domyślnie 4. */
  weeklyTarget: number;
  /** Tonaż lub suma e1RM-proxy w tym tygodniu (względem siebie). */
  volumeThisWeek: number;
  volumePrevWeek: number;
  /** Ile kolejnych tygodni wstecz z ≥1 sesją (w tym bieżący). */
  streakWeeks: number;
  /** 0–1 średni postęp aktywnych challenge; 0 jeśli brak. */
  challengeProgressAvg: number;
  /** Czy dołączył do ≥1 aktywnego challenge. */
  challengeJoined: boolean;
  /** Zdarzenia social (post+comment+reaction given), po capie dziennym. */
  socialEvents: number;
  /** Zdarzenia pomocy (reakcja/komentarz na cudzy post). */
  helpEvents: number;
  /** Ile live group workoutów w tym tygodniu. */
  liveSessionsJoined: number;
  /** Czy nowicjusz (konto/członkostwo < 21 dni). */
  isNewcomer: boolean;
};

export const FCS_COMPONENT_LABELS: Record<FcsComponentKey, string> = {
  progress: "Progres tygodnia",
  regularity: "Regularność",
  plan: "Plan / cel",
  streak: "Streak",
  challenge: "Challenge",
  social: "Aktywność social",
  help: "Pomoc innym",
  live: "Live treningi",
};

/** Soft-cap wzrostu: +50% objętości ≈ 1.0; powyżej asymptota. */
export function progressComponent(
  volumeThisWeek: number,
  volumePrevWeek: number,
  sessionsThisWeek: number,
): number {
  if (sessionsThisWeek <= 0) return 0;
  // Pierwszy tydzień z danymi — baseline (szansa nowicjusza), nie kara.
  if (volumePrevWeek <= 0) {
    return volumeThisWeek > 0 ? 0.55 : 0;
  }
  const pct = (volumeThisWeek - volumePrevWeek) / volumePrevWeek;
  // tanh mapuje ~±∞ → (−1,1); skalujemy tak, by +50% ≈ 1
  const scaled = Math.tanh(pct / 0.5);
  // stagnacja 0 → 0.45 (neutral), regresja w dół, progres w górę
  return clamp01(0.45 + 0.55 * scaled);
}

export function regularityComponent(
  sessions: number,
  uniqueDays: number,
  weeklyTarget: number,
): number {
  const target = Math.max(1, weeklyTarget);
  const sessionRatio = clamp01(sessions / target);
  const dayRatio = clamp01(uniqueDays / Math.min(7, Math.max(3, target)));
  return clamp01(0.65 * sessionRatio + 0.35 * dayRatio);
}

export function planComponent(sessions: number, weeklyTarget: number): number {
  const target = Math.max(1, weeklyTarget);
  return clamp01(sessions / target);
}

export function streakComponent(streakWeeks: number): number {
  return clamp01(streakWeeks / 8);
}

export function challengeComponent(
  joined: boolean,
  progressAvg: number,
): number {
  if (!joined) return 0;
  return clamp01(0.35 + 0.65 * clamp01(progressAvg));
}

/** Log-scale: 0→0, 3→~0.5, 10+→~1.0 */
export function socialComponent(events: number): number {
  if (events <= 0) return 0;
  return clamp01(Math.log1p(events) / Math.log1p(12));
}

export function helpComponent(events: number): number {
  if (events <= 0) return 0;
  return clamp01(Math.log1p(events) / Math.log1p(10));
}

export function liveComponent(sessionsJoined: number): number {
  if (sessionsJoined <= 0) return 0;
  return clamp01(sessionsJoined / 3);
}

export function computeFcs(input: FcsInput): FcsBreakdown {
  const components: FcsComponents = {
    progress: progressComponent(
      input.volumeThisWeek,
      input.volumePrevWeek,
      input.sessionsThisWeek,
    ),
    regularity: regularityComponent(
      input.sessionsThisWeek,
      input.uniqueDaysThisWeek,
      input.weeklyTarget,
    ),
    plan: planComponent(input.sessionsThisWeek, input.weeklyTarget),
    streak: streakComponent(input.streakWeeks),
    challenge: challengeComponent(
      input.challengeJoined,
      input.challengeProgressAvg,
    ),
    social: socialComponent(input.socialEvents),
    help: helpComponent(input.helpEvents),
    live: liveComponent(input.liveSessionsJoined),
  };

  // Zero sesji → nie zajmuj miejsca w rankingu „pustymi” punktami social.
  if (input.sessionsThisWeek <= 0) {
    const zero = zeroComponents();
    return { components: zero, raw: 0, newcomerBoost: 0, fcs: 0 };
  }

  let raw = 0;
  for (const key of Object.keys(FCS_WEIGHTS) as FcsComponentKey[]) {
    raw += FCS_WEIGHTS[key] * components[key];
  }
  raw = clamp(0, 100, Math.round(raw * 1000) / 10);

  const newcomerBoost =
    input.isNewcomer && input.sessionsThisWeek >= 2 ? 5 : 0;
  const fcs = clamp(0, 100, Math.round((raw + newcomerBoost) * 10) / 10);

  return { components, raw, newcomerBoost, fcs };
}

function zeroComponents(): FcsComponents {
  return {
    progress: 0,
    regularity: 0,
    plan: 0,
    streak: 0,
    challenge: 0,
    social: 0,
    help: 0,
    live: 0,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clamp(min: number, max: number, n: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/** Cap zdarzeń social/help — anty-farmienie. */
export function capEvents(count: number, cap = 20): number {
  return Math.max(0, Math.min(cap, Math.round(count)));
}
