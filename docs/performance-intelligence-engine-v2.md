# GymBrat Performance Intelligence Engine v2

**Status:** architektura (zapowiedź)  
**Data:** 2026-10-14  
**Kompatybilność:** pełna wsteczna z `/progress`, `ProgressHubData`, JSON sesji `completed_session` / `cardio_log`  
**Źródło prawdy raw:** istniejące tabele Drizzle + kontrakty w `lib/progress-hub.ts`, `docs/progress-training-analysis.json`

---

## 0. Teza produktowa

Obecny hub Postępów odpowiada na pytanie: *„jakie liczby mam?”*  
PIE v2 odpowiada na pytania: *„czy rosnę? czy jestem gotowy? co zrobić jutro?”*

**Zasada nadrzędna:** dane są wejściem. Wynikiem jest decyzja treningowa w formie:

1. **Co się dzieje?** (stan)
2. **Dlaczego?** (przyczyna z dowodem)
3. **Co zrobić dalej?** (akcja)

Wykresy są opcjonalnym dowodem pod insightem — nigdy główne UI.

---

## 1. Ocena stanu obecnego (v1)

### Co działa i zostaje

| Obszar | Lokalizacja | Zachowanie |
|--------|-------------|------------|
| Tonaż `reps × weight` | `progress-hub`, `workout-session-calculations` | bez zmian semantycznych |
| e1RM Epley | `workout-history.estimated1RM` | `e1rm_formula_version: "epley_v1"` |
| Hard sets (RIR≤1 ∨ RPE≥8) | `intensity-analysis` | bazowa definicja hard set |
| Dieta×trening tygodnie | `diet-training-weeks` | feed do Nutrition Quality |
| Cardio minuty / avg HR | `cardio-*` | input do Cardio Load |
| Mięśnie katalog | `resolve-exercise-muscles` | rozszerzone o wagi primary/secondary |
| Live coach / progresja serii | `live-set-coach`, `set-progression-suggestion` | osobna warstwa live; PIE konsumuje post-session |

### Luki vs Hevy / Strong / Garmin / RP / Alpha Progression

- Brak gotowości (readiness) i ACWR
- Cardio = minuty, nie obciążenie stref
- Brak volume per mięsień z alokacją
- Brak zunifikowanego coach insight engine
- Sylwetka = waga + obwody, bez fazy kompozycji
- Zdjęcia = porównanie Start/Teraz, bez scoringu wizualnego
- Brak predykcji i Goal Success Probability
- Insighty rozproszone (`briefing-heuristic`, achievements, live coach)

### Werdykt

Model raw jest **wystarczający jako źródło**. Model decyzyjny jest **zbyt słaby**.  
Projektujemy **nowy silnik pochodny (derived)** od zera + **warstwę kompatybilności** dla UI v1.

---

## 2. Architektura warstwowa

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation: Intelligence Hub (/progress + /coach)         │
│  Answers · Decisions · Evidence (collapse) · Legacy tabs     │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Decision Layer                                              │
│  InsightEngine · AI Coach · Goal Probability · TomorrowPlan  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Domain Engines (pure TS, versioned algorithms)              │
│  AthleteScore · Recovery · Fatigue · CardioLoad · Muscle     │
│  Progression · BodyComp · PhotoAI · Nutrition · RelativeStr  │
│  ExerciseQuality · Stagnation · Prediction                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Fact Layer (derived, idempotent recompute)                  │
│  pie_daily_facts · pie_session_facts · pie_muscle_daily      │
│  pie_exercise_daily · pie_snapshots · pie_insights           │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Compatibility Adapter                                       │
│  buildProgressHubData() ← bez zmian kontraktu                │
│  toPieInputsFromLegacy() · fromPieSnapshotToHubExtras()      │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Raw Sources (immutable history)                             │
│  workouts · weight_logs · body_reports · body_report_photos  │
│  daily_checkins · meal_logs · user_settings · workout_plans  │
└─────────────────────────────────────────────────────────────┘
```

**Reguła:** nigdy nie mutujemy historycznego JSON sesji pod nowe metryki. Nowe pola opcjonalne przy zapisie *przyszłych* sesji; backfill tylko w Fact Layer.

---

## 3. Modele danych (DB Drizzle)

### 3.1 Nowe tabele

```sql
-- Snapshot dnia użytkownika (główny read model UI)
CREATE TABLE pie_daily_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,                 -- YYYY-MM-DD lokalnie
  algo_version TEXT NOT NULL,         -- np. "pie_2.0.0"
  athlete_score REAL,
  athlete_score_delta_7d REAL,
  recovery_readiness REAL,
  training_prescription TEXT,         -- train_hard|train_normal|deload|recovery_day
  fatigue_acute REAL,
  fatigue_chronic REAL,
  acwr REAL,
  cardio_load REAL,
  nutrition_quality REAL,
  body_phase TEXT,                    -- lean_gain|bulk|recomp|fat_loss|plateau|unknown
  visual_progress REAL,
  confidence REAL NOT NULL,           -- 0-1 pokrycie danych
  payload_json TEXT NOT NULL,         -- pełny PieDailySnapshot
  computed_at INTEGER NOT NULL,
  UNIQUE(user_id, date, algo_version)
);

CREATE TABLE pie_session_facts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  algo_version TEXT NOT NULL,
  tonnage_kg REAL NOT NULL,
  hard_sets INTEGER NOT NULL,
  scored_sets INTEGER NOT NULL,
  avg_rpe REAL,
  avg_rir REAL,
  session_load REAL NOT NULL,         -- unified load units
  cardio_load REAL NOT NULL DEFAULT 0,
  duration_min REAL,
  payload_json TEXT NOT NULL,
  computed_at INTEGER NOT NULL,
  UNIQUE(workout_id, algo_version)
);

CREATE TABLE pie_muscle_daily (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  muscle TEXT NOT NULL,               -- PieMuscleId
  algo_version TEXT NOT NULL,
  hard_sets REAL NOT NULL,            -- fractional OK
  weekly_volume_sets REAL,            -- rolling 7d
  relative_volume REAL,               -- vs athlete baseline
  fatigue REAL,
  recovery REAL,
  status TEXT,                        -- undertrained|optimal|overloaded
  payload_json TEXT,
  UNIQUE(user_id, date, muscle, algo_version)
);

CREATE TABLE pie_exercise_daily (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  exercise_key TEXT NOT NULL,
  algo_version TEXT NOT NULL,
  best_e1rm REAL,
  volume_kg REAL,
  hard_sets INTEGER,
  relative_strength REAL,             -- e1RM / bodyWeight
  progression_state TEXT,             -- progressing|maintaining|stagnating|regressing
  quality_score REAL,
  stagnation_weeks INTEGER,
  payload_json TEXT,
  UNIQUE(user_id, date, exercise_key, algo_version)
);

CREATE TABLE pie_insights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  kind TEXT NOT NULL,                 -- daily|post_session|goal|stagnation
  workout_id TEXT,
  priority INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  why TEXT NOT NULL,
  action TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  model TEXT,                         -- heuristic|llm:<model>
  created_at INTEGER NOT NULL
);

CREATE TABLE pie_predictions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  as_of_date TEXT NOT NULL,
  horizon_days INTEGER NOT NULL,      -- 30|90
  target_kind TEXT NOT NULL,          -- body_weight|e1rm|goal
  target_key TEXT,                    -- exercise_key / goal_id
  predicted_value REAL NOT NULL,
  low REAL,
  high REAL,
  probability REAL,                   -- dla goals 0-100
  assumptions_json TEXT NOT NULL,
  algo_version TEXT NOT NULL,
  computed_at INTEGER NOT NULL
);

CREATE TABLE pie_photo_analyses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  photo_id TEXT NOT NULL,             -- body_report_photos.id
  algo_version TEXT NOT NULL,
  visual_progress_score REAL,
  v_taper REAL,
  symmetry REAL,
  shoulder_width_norm REAL,
  waist_norm REAL,
  confidence REAL,
  payload_json TEXT NOT NULL,
  computed_at INTEGER NOT NULL,
  UNIQUE(photo_id, algo_version)
);

CREATE INDEX idx_pie_daily_user_date ON pie_daily_snapshots(user_id, date);
CREATE INDEX idx_pie_muscle_user_date ON pie_muscle_daily(user_id, date);
CREATE INDEX idx_pie_insights_user_date ON pie_insights(user_id, date);
```

### 3.2 Opcjonalne rozszerzenia raw (non-breaking)

Przy przyszłych zapisach (nullable / JSON extras):

```ts
// cardio_log / completed_session.cardio extras
type CardioV2Extras = {
  hrMax?: number;
  hrRest?: number;
  zoneSeconds?: Partial<Record<"z1"|"z2"|"z3"|"z4"|"z5", number>>;
  source?: "manual" | "wearable" | "estimated";
};

// daily_checkins extras (summaryJson lub nowe kolumny nullable)
type SleepV2Extras = {
  sleepMinutes?: number;
  bedtime?: string;
  wakeTime?: string;
};
```

Brak tych pól → silnik używa proxy (jakość snu 1–10, avg HR → estymacja stref) z obniżonym `confidence`.

---

## 4. TypeScript — kontrakty PIE v2

Lokalizacja docelowa: `lib/pie-v2/`

```ts
/** lib/pie-v2/types.ts */

export const PIE_ALGO_VERSION = "pie_2.0.0" as const;

export type PieMuscleId =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "core";

export type AthleteTier =
  | "beginner"        // 0-20
  | "developing"      // 21-40
  | "advanced"        // 41-60
  | "high"            // 61-80
  | "elite";          // 81-100

export type TrainingPrescription =
  | "train_hard"
  | "train_normal"
  | "deload_recommended"
  | "recovery_day";

export type AcwrBand =
  | "undertraining"   // < 0.8
  | "optimal"         // 0.8-1.3
  | "elevated_risk";  // > 1.3

export type MuscleLoadStatus = "undertrained" | "optimal" | "overloaded";

export type ProgressionState =
  | "progressing"
  | "maintaining"
  | "stagnating"
  | "regressing";

export type BodyPhase =
  | "lean_gain"
  | "bulk"
  | "recomp"
  | "fat_loss"
  | "plateau"
  | "unknown";

export type InsightKind = "observation" | "problem" | "recommendation";

export type DecisionTriple = {
  what: string;
  why: string;
  next: string;
};

export type MetricEvidence = {
  metric: string;
  value: number | string;
  unit?: string;
  window?: string;
  delta?: number;
};

export type ScoredMetric = {
  score: number;          // 0-100
  weight: number;         // udział w agregacie
  confidence: number;     // 0-1
  evidence: MetricEvidence[];
};

export type AthleteScoreResult = {
  score: number;
  tier: AthleteTier;
  delta7d: number | null;
  components: {
    strength: ScoredMetric;
    bodyMass: ScoredMetric;
    physique: ScoredMetric;
    cardio: ScoredMetric;
    recovery: ScoredMetric;
    consistency: ScoredMetric;
    nutrition: ScoredMetric;
  };
  decision: DecisionTriple;
};

export type RecoveryReadinessResult = {
  score: number;
  prescription: TrainingPrescription;
  components: {
    sleep: ScoredMetric;
    calories: ScoredMetric;
    protein: ScoredMetric;
    strengthDrop: ScoredMetric;
    bodyMassChange: ScoredMetric;
    cardioLoad: ScoredMetric;
    fatigue: ScoredMetric;
  };
  decision: DecisionTriple;
};

export type FatigueEngineResult = {
  acuteLoad: number;      // 7d
  chronicLoad: number;    // 42d
  acwr: number | null;
  band: AcwrBand | "insufficient_data";
  inputs: {
    weeklyTonnage: number;
    hardSets7d: number;
    avgRpe7d: number | null;
    frequency7d: number;
    cardioLoad7d: number;
  };
  decision: DecisionTriple;
};

export type HrZoneId = "z1" | "z2" | "z3" | "z4" | "z5";

export type CardioLoadResult = {
  sessionLoad: number;
  zoneSeconds: Record<HrZoneId, number>;
  zonePct: Record<HrZoneId, number>;
  aerobicTrend: ProgressionState;
  decision: DecisionTriple;
};

export type MuscleAnalyticsRow = {
  muscle: PieMuscleId;
  hardSets7d: number;
  weeklyVolumeSets: number;
  relativeVolume: number;
  fatigue: number;
  recovery: number;
  status: MuscleLoadStatus;
  decision: DecisionTriple;
};

export type AiCoachSessionReport = {
  workoutId: string;
  wentWell: string[];
  wentPoorly: string[];
  limitingFactors: string[];
  nextSessionChanges: string[];
  narrative: string;
  evidence: MetricEvidence[];
};

export type ProgressionResult = {
  scope: "exercise" | "muscle";
  key: string;
  state: ProgressionState;
  e1rmTrendPct: number | null;
  volumeTrendPct: number | null;
  hardSetsTrendPct: number | null;
  rirTrend: number | null;
  rpeTrend: number | null;
  decision: DecisionTriple;
};

export type BodyCompResult = {
  phase: BodyPhase;
  weightTrendKgPerWeek: number | null;
  circumferenceSignal: "improving" | "worsening" | "mixed" | "flat" | "unknown";
  photoSignal: "improving" | "flat" | "regressing" | "unavailable";
  decision: DecisionTriple;
};

export type PhotoAiResult = {
  visualProgressScore: number;
  vTaperScore: number;
  symmetryScore: number;
  shoulderWidthNorm: number;
  waistNorm: number;
  confidence: number;
  decision: DecisionTriple;
};

export type NutritionQualityResult = {
  score: number;
  kcalAdherencePct: number | null;
  proteinAdherencePct: number | null;
  weightTempoAligned: boolean | null;
  goalAligned: boolean | null;
  decision: DecisionTriple;
};

export type RelativeStrengthPoint = {
  exerciseKey: string;
  absoluteE1rm: number;
  bodyWeightKg: number;
  relativeStrength: number;
};

export type ExerciseQualityResult = {
  exerciseKey: string;
  score: number;
  progression: number;
  frequency: number;
  consistency: number;
  rpeQuality: number;
  rirQuality: number;
  decision: DecisionTriple;
};

export type StagnationAlert = {
  exerciseKey: string;
  weeksWithoutStrengthGain: 3 | 6 | 8;
  recommendation: string;
  decision: DecisionTriple;
};

export type PredictionPoint = {
  kind: "body_weight" | "e1rm";
  key?: string;
  horizonDays: 30 | 90;
  predicted: number;
  low: number;
  high: number;
};

export type GoalSuccessProbability = {
  goalId: string;
  label: string;
  currentValue: number;
  targetValue: number;
  probabilityPct: number;
  etaWeeks: number | null;
  neededChanges: string[];
  decision: DecisionTriple;
};

export type DailyInsightPack = {
  date: string;
  observations: [string, string, string];
  problems: [string, string, string];
  recommendations: [string, string, string];
  rawForbidden: true; // kontrakt UI: nie renderuj surowych serii bez interpretacji
};

export type PieDailySnapshot = {
  algoVersion: typeof PIE_ALGO_VERSION | string;
  date: string;
  confidence: number;
  athleteScore: AthleteScoreResult;
  recovery: RecoveryReadinessResult;
  fatigue: FatigueEngineResult;
  cardio: CardioLoadResult | null;
  muscles: MuscleAnalyticsRow[];
  nutrition: NutritionQualityResult;
  bodyComp: BodyCompResult;
  visualProgress: number | null;
  insights: DailyInsightPack;
  tomorrow: DecisionTriple;
  predictions: PredictionPoint[];
  goals: GoalSuccessProbability[];
};

/** Opcjonalne rozszerzenie ProgressHubData — nigdy nie usuwa pól v1 */
export type ProgressHubDataV2Extras = {
  pie?: {
    enabled: boolean;
    asOfDate: string;
    athleteScore: number;
    athleteTier: AthleteTier;
    athleteDelta7d: number | null;
    recoveryReadiness: number;
    prescription: TrainingPrescription;
    acwr: number | null;
    acwrBand: AcwrBand | "insufficient_data";
    nutritionQuality: number;
    bodyPhase: BodyPhase;
    topInsights: DailyInsightPack;
    tomorrow: DecisionTriple;
  };
};
```

---

## 5. Formuły silników

Wszystkie formuły są czystymi funkcjami w `lib/pie-v2/engines/*` z testami golden + property. Każdy wynik niesie `algo_version` i `confidence`.

### 5.1 Unified Session Load (SL)

Baza Fatigue + ACWR (jednostki umowne):

```
SL = 0.45 * normalize(tonnageKg) 
   + 0.25 * hardSets 
   + 0.15 * (avgRpe ?? 6) 
   + 0.15 * CardioLoad_session
```

`normalize(tonnage)` = tonnage / rolling_p90_tonnage_athlete (clamp 0–3).

### 5.2 Fatigue Engine / ACWR

```
Acute  = Σ SL(d) for d in [today-6 … today]          // 7 dni
Chronic = mean daily SL over [today-41 … today]       // 42 dni
ACWR = Acute / (Chronic * 7)   // gdy Chronic > próg minimalny
```

Pasma (literatura Banister / Gabbett, uproszczone):

| ACWR | Band | Decyzja |
|------|------|---------|
| < 0.8 | undertraining | zwiększ objętość / częstotliwość |
| 0.8–1.3 | optimal | utrzymuj plan |
| > 1.3 | elevated_risk | deload / redukcja hard sets |
| brak chronic | insufficient_data | zbieraj ≥21 dni |

### 5.3 Recovery Readiness (0–100)

Wagi domyślne (renormalizowane gdy brak danych):

| Składnik | Waga | Proxy gdy brak |
|----------|------|----------------|
| sen | 0.22 | sleepQuality 1–10 → ×10 |
| kcal | 0.14 | adherence vs goal (85–110 = max) |
| białko | 0.14 | protein adherence |
| spadki siły | 0.16 | Δ e1RM top-lift 7d |
| Δ masy | 0.10 | tempo vs cel (za szybki spadek = kara) |
| cardio load | 0.10 | CardioLoad_7d vs chronic |
| fatigue | 0.14 | odwrotność ACWR risk |

Prescription:

```
≥ 75 i ACWR ≤ 1.2          → train_hard
55–74                      → train_normal
40–54 lub ACWR > 1.3       → deload_recommended
< 40                       → recovery_day
```

### 5.4 Athlete Score (0–100)

Komponenty (cel użytkownika przesuwa wagi ±20% względnie):

| Komponent | Sygnał |
|-----------|--------|
| strength | percentyle relative strength + trend e1RM 8 tyg |
| bodyMass | zgodność tempa kg/tydz z celem |
| physique | Δ obwodów + Visual Progress (jeśli jest) |
| cardio | Zone2+ czas + trend CardioLoad |
| recovery | średnia Recovery 14d |
| consistency | % tygodni z ≥ target sessions (12 tyg) |
| nutrition | Nutrition Quality |

Tier: 0–20 / 21–40 / 41–60 / 61–80 / 81–100.

Trend tygodniowy: `score(today) − score(today−7)`.

### 5.5 Cardio Load 2.0

Strefy (Karvonen jeśli jest HRrest+HRmax, inaczej %HRmax estymowane wiekiem):

```
HRr = HRmax − HRrest
Z1: < 50% HRr   Z2: 50–60  Z3: 60–70  Z4: 70–80  Z5: > 80
```

Jeśli tylko `avgHr` + minutes:

```
estZone = map(avgHr / HRmax)
CardioLoad = minutes * zoneWeight[estZone]
zoneWeights = {z1:1, z2:1.5, z3:2.5, z4:4, z5:5.5}  // TRIMP-like
```

Jeśli `zoneSeconds` dostępne → dokładny sum TRIMP.

Wydolność: trend mediany CardioLoad w Z2 przy stałym czasie (8 tyg) + spadek avg HR przy tym samym pace (gdy pace dostępne).

### 5.6 Muscle Analytics

Mapowanie katalogu GymBrat → `PieMuscleId` (agregacja regionów back_* → `back`).

Alokacja hard set / volume set:

```
primary:   1.0
secondary: 0.5
```

Status (7d rolling, cele zależne od split — domyślnie hypertrofia):

| Hard sets / tydz | Status |
|------------------|--------|
| < 6 | undertrained |
| 6–20 | optimal |
| > 20 | overloaded (zależnie od recovery mięśnia) |

`fatigue` ↑ z hard sets i bliskością RIR≤1; `recovery` ↑ z dniami od ostatniego bodźca.

### 5.7 Progression Engine

Na ćwiczeniu (okno 21–28 dni, min 3 sesje):

```
Δe1RM ≥ +2%  i volume nie −15%     → progressing
|Δe1RM| < 2% i volume flat         → maintaining
Δe1RM flat ≥ 21d                   → stagnating
Δe1RM ≤ −2%                        → regressing
```

Mięsień: agregacja weighted po ćwiczeniach primary.

### 5.8 Body Composition Intelligence

**Nigdy sama waga.** Macierz:

| Tempo wagi | Obwody (pas↓ barki/klatka↑) | Faza |
|------------|-----------------------------|------|
| + wolno | poprawa proporcji | lean_gain |
| + szybko | pas↑ | bulk |
| flat | poprawa proporcji | recomp |
| − | pas↓ | fat_loss |
| flat | flat ≥ 21d | plateau |

### 5.9 Photo AI

Pipeline (feature-flag, privacy-first, on-device lub server opt-in):

1. Pose normalize (bark–biodro–kostka)
2. Ratio bark/talia → V-taper
3. L/R asymmetry → symmetry
4. Visual Progress Score = f(Δ ratios vs baseline photo, confidence pose)

Bez modelu ML na start: **heuristic landmark ratios** z ręcznymi punktami użytkownika (opcjonalnie) + późniejszy model. Score `null` gdy confidence < 0.4.

### 5.10 Nutrition Quality Score

```
NQS = 0.35*kcalScore + 0.35*proteinScore + 0.15*tempoAlign + 0.15*goalAlign
```

`kcalScore` / `proteinScore`: trapez 85–110% = 100, poza liniowy spadek.  
`tempoAlign`: tempo masy zgodne z fazą celu.

### 5.11 Relative Strength

```
relativeStrength = bestE1rm / bodyWeightKg
```

Body weight = ostatni punkt wagi ≤ data sesji (jak dedupe v1).

### 5.12 Exercise Quality Score

```
EQ = 0.30*progression + 0.20*frequency + 0.20*consistency
   + 0.15*rpeQuality + 0.15*rirQuality
```

`rpeQuality`: obecność + rozsądny zakres (nie same 10).  
`rirQuality`: zgodność z target ±0.75 (z intensity-analysis).

### 5.13 Stagnation Detection

Brak wzrostu best e1RM (rolling max) przez 3 / 6 / 8 tygodni → alert + rekomendacje z Progression + Muscle + Recovery (deload, volume+, variation, technique).

### 5.14 Prediction Engine

Model prosty, interpretowalny (nie black-box):

- Waga 30/90d: regresja tempa 42d + korekta NQS + compliance
- e1RM 30/90d: trend e1RM 8 tyg × expected sessions × recovery factor × ACWR penalty

Przedziały: ±1.28 × σ residual (80% PI).

### 5.15 Goal Success Probability

Dla celu (np. Bench 140):

```
requiredRate = (target − current) / weeksAvailable
expectedRate = predicted_e1rm_slope
P = sigmoid(k * (expectedRate / requiredRate − 1)) * recoveryFactor * consistencyFactor
```

Output: % + ETA + `neededChanges[]`.

### 5.16 Insight Engine

Codziennie dokładnie 3+3+3. Ranking po:

1. ryzyko kontuzji / ACWR
2. konflikt dieta↔cel
3. stagnacja top liftów
4. undertrained mięśnie w planie
5. mocne wins (PR, adherence)

Post-session AI Coach: ten sam DecisionTriple + 4 listy; LLM tylko gdy `PIE_LLM=1`, inaczej template heuristic z dowodami liczbowymi (jak w przykładzie bench + volume chest).

---

## 6. Backend

### 6.1 Moduły plików

```
lib/pie-v2/
  types.ts
  version.ts
  facts/
    extract-session-facts.ts
    extract-daily-facts.ts
    muscle-allocation.ts
  engines/
    athlete-score.ts
    recovery-readiness.ts
    fatigue.ts
    cardio-load.ts
    muscle-analytics.ts
    progression.ts
    body-comp.ts
    photo-ai.ts
    nutrition-quality.ts
    relative-strength.ts
    exercise-quality.ts
    stagnation.ts
    prediction.ts
    goal-probability.ts
  insights/
    insight-engine.ts
    ai-coach.ts
    templates-pl.ts
  jobs/
    recompute-user-day.ts
    recompute-user-range.ts
    backfill.ts
  adapters/
    from-legacy.ts          // raw → facts
    to-progress-hub.ts      // snapshot → ProgressHubDataV2Extras
  index.ts
```

### 6.2 API

| Endpoint | Rola |
|----------|------|
| `GET /api/pie/today` | snapshot dnia + insights + tomorrow |
| `GET /api/pie/range?from&to` | lista snapshotów (sparklines decyzji) |
| `GET /api/pie/muscles` | 7/14/28d muscle rows |
| `GET /api/pie/exercises/[key]` | progression + quality + relative + preds |
| `POST /api/pie/recompute` | admin/user force recompute |
| `GET /api/pie/session/[workoutId]/coach` | post-session report |

Istniejące:

- `GET /api/progress/exercise` — **bez breaking changes**
- `buildProgressHubData` — dopina `pie?` opcjonalnie

### 6.3 Kiedy liczyć

| Trigger | Job |
|---------|-----|
| `POST /api/workouts/complete` | session facts + day snapshot + coach report |
| meal log / check-in / body report | day snapshot (debounce 30s) |
| nocny cron | predictions + goal probs + insight pack |
| deploy nowej `algo_version` | backfill last 180d w tle |

Idempotencja: `UNIQUE(user, date, algo_version)`.

---

## 7. UI — Intelligence Hub (nie dashboard)

### 7.1 Hierarchia ekranu `/progress`

1. **Nagłówek decyzji dnia**  
   Athlete Score + trend 7d · Recovery · Prescription (duży CTA)
2. **Tomorrow card** — jedna DecisionTriple
3. **Insight pack** — 3 / 3 / 3 (tekst)
4. **Muscle strip** — statusy under/opt/over (tap → decision)
5. **Goals probability** — jeśli cele zdefiniowane
6. **Legacy tabs** (Siła / Sylwetka / Zdjęcia / Tydzień) — evidence, nie hub

Zasada: zero surowych tabel na pierwszym viewport bez interpretacji.

### 7.2 Post-session sheet

Po zakończeniu treningu: AiCoachSessionReport (4 bloki + narrative).

### 7.3 Compatibility

Feature flag `pieV2Enabled` w `user_settings` / remote config.  
Gdy off → UI identyczny z v1.

---

## 8. Migracja danych

### Faza A — zero downtime

1. Deploy tabel `pie_*` + kod silników (flag off)
2. Backfill job: ostatnie 180 dni / user (limit jak v1)
3. Dual-write w `workouts/complete`
4. Shadow mode: loguj snapshot vs stare trendy (monitoring)

### Faza B — UI soft launch

1. `pie?` w `ProgressHubData` dla opted-in
2. Intelligence header nad istniejącymi tabami
3. Changelog `planned: true`

### Faza C — domyślnie on

1. Promote + usunięcie `planned`
2. Stary `lib/progress-analysis.ts` pozostaje dead code do usunięcia osobnym PR

### Mapowanie legacy → v2

| Legacy | v2 |
|--------|-----|
| volumeKg sesji | session_facts.tonnage_kg |
| hardSetPct | hard_sets / scored_sets |
| estimated1RM Epley | best_e1rm (epley_v1) |
| countableCardioMinutes | input cardio load |
| diet adherence | Nutrition Quality partial |
| sleepQuality check-in/report | Recovery sleep proxy |
| resolve-exercise-muscles | muscle allocation weights |
| ProgressHubData | + opcjonalne `pie` |

Niespójność `isCountedPerformedSet` vs `done===true` w hub: **Fact Layer używa reguły hub (`done && !skipped`)** i dokumentuje to w `eligibility` — jedna kanoniczna reguła dla PIE.

---

## 9. Testy

```
lib/pie-v2/**/*.test.ts
```

| Warstwa | Co |
|---------|----|
| Unit engines | golden fixtures (JSON in/out) per formula |
| Eligibility | parity z `docs/progress-training-analysis.json` |
| ACWR | sparse data, ramp-up <21d, spike injury band |
| Muscle allocation | primary/secondary fractions |
| Insight engine | zawsze 3+3+3, PL copy, no raw dumps |
| Adapter | `ProgressHubData` snapshot equality gdy pie off |
| Integration | complete workout → facts → snapshot → coach |
| Migration | backfill 180d idempotent |

CI: `npm test -- pie-v2` w `deploy:check`.

---

## 10. Refaktoryzacja istniejących modułów

| Moduł | Zmiana |
|-------|--------|
| `lib/progress-hub.ts` | cienki orchestrator + opcjonalne `pie`; kalkulacje volume **zostają** (parity) |
| `lib/intensity-analysis.ts` | eksport shared `isHardSet` używany przez PIE |
| `lib/resolve-exercise-muscles.ts` | dodaj `allocationWeights()` bez zmiany mannequina |
| `lib/workout-history.ts` | oznacz `estimated1RM` jako epley_v1; nie zmieniać wyniku |
| `lib/diet-training-weeks.ts` | feed do Nutrition Quality (reuse) |
| `lib/cardio-*.ts` | dodaj helper stref; stare minuty bez zmian API |
| `lib/briefing-heuristic.ts` | deleguj do InsightEngine gdy flag on |
| `lib/live-set-coach.ts` | bez zmian (live); post-session → AiCoach |
| `components/progress/*` | Intelligence header; tabs bez regresji |
| `docs/progress-training-analysis.json` | dopisek `relatedDocs: pie-v2` |

**Nie robić:** big-bang rewrite hub. **Nie ruszać:** kontrakt PR / exercise identity keys.

---

## 11. Strategia wdrożenia (GymBrat-only)

1. **PR1** — schema + types + engines + tests (flag off)  
2. **PR2** — jobs + API + dual-write + backfill  
3. **PR3** — UI Intelligence header + post-session coach (Preview)  
4. Changelog `planned: true`, `sourceRepo` GymBrat  
5. `npm run deploy:check` / deploy-guardian  
6. Merge → Preview Vercel → zatwierdzenie → Promote  
7. Monitor confidence median, insight CTR, ACWR false-positive rate  

Publiczny kontrakt `GET /api/version` bez `plannedChangelog` na produkcji po Promote.

---

## 12. Prywatność i bezpieczeństwo Photo AI

- Analiza tylko za zgodą; zdjęcia już szyfrowane w storage
- Wyniki w `pie_photo_analyses`, nie w client-side permanent cache
- Brak wysyłki zdjęć do LLM bez osobnego opt-in
- Heurystyka lokalna jako default

---

## 13. Definition of Done (v2.0)

- [ ] Athlete Score + tier + Δ7d
- [ ] Recovery Readiness + 4 prescriptions
- [ ] Fatigue Acute/Chronic/ACWR + bands
- [ ] Cardio Load + strefy (exact lub estimated)
- [ ] Muscle analytics 10 grup + status
- [ ] AI Coach post-session (heuristic PL)
- [ ] Progression state per exercise/muscle
- [ ] Body phase ≠ sama waga
- [ ] Nutrition Quality 0–100
- [ ] Relative strength
- [ ] Exercise Quality
- [ ] Stagnation 3/6/8
- [ ] Predictions 30/90
- [ ] Goal Success Probability
- [ ] Daily 3/3/3 insights
- [ ] `ProgressHubData` bez breaking changes
- [ ] Feature flag + backfill 180d
- [ ] Testy golden + parity eligibility

---

## 14. Anty-cele (czego NIE robimy w v2.0)

- Nie zastępujemy Epley bez versioned dual-calc
- Nie wymagamy wearables do działania (tylko wyższy confidence)
- Nie budujemy „dashboardu 40 wykresów”
- Nie kopiujemy metryk / copy z AWP ani innych produktów
- Nie pushujemy na `master` bez PR/Preview

---

## 15. Mapowanie pytań produktowych → silniki

| Pytanie użytkownika | Silnik | Output |
|---------------------|--------|--------|
| Czy rosnę? | BodyComp + Photo + AthleteScore Δ | faza + decyzja |
| Czy silniejszy? | Progression + RelativeStrength | state + next |
| Czy odzyskuję siły? | Recovery + Fatigue | prescription |
| Czy dieta działa? | Nutrition + BodyComp | NQS + align |
| Czy regeneracja OK? | Recovery | score + day type |
| Czy objętość optymalna? | Muscle + Fatigue | status mięśni + ACWR |
| Ryzyko stagnacji? | Stagnation + Progression | alert 3/6/8 |
| Ryzyko przetrenowania? | ACWR + Recovery | elevated_risk |
| Co jutro? | Insight + Recovery + Tomorrow | DecisionTriple |

**Koniec architektury v2.0 — gotowe do implementacji PR1.**
