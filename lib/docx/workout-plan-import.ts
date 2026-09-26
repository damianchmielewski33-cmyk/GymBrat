import { randomUUID } from "node:crypto";
import mammoth from "mammoth";
import { findBestCatalogMatch } from "@/lib/workout-exercise-catalog";
import type { WorkoutPlanExercise, WorkoutPlanPayload } from "@/lib/workout-plan-types";

export type ParsedWorkoutPlanImport = {
  plans: WorkoutPlanPayload[];
  warnings: string[];
};

const WEEKDAY_RE =
  /^(poniedziałek|poniedzialek|wtorek|środa|sroda|czwartek|piątek|piatek|sobota|niedziela|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

const DAY_HEADER_RE =
  /^(dzie[nń]\s*[a-z0-9]+|day\s*[a-z0-9]+|trening\s*[a-z0-9]+|sesja\s*[a-z0-9]+|push(?:\s*[ab12])?|pull(?:\s*[ab12])?|nogi|klatka(?:\s*\+\s*.+)?|barki(?:\s*\+\s*.+)?|legs?(?:\s*[ab12])?|upper(?:\s*[ab12])?|lower(?:\s*[ab12])?|full\s*body|fbw|a\/b|plan\s+.+)$/i;

const SETS_REPS_RE =
  /(\d{1,2})\s*[x×]\s*(\d{1,3}(?:-\d{1,3})?)/i;

/** Zapis trenerów: „2s 8-10p”, „3s 8-10”. */
const SETS_P_RE = /(\d{1,2})\s*s\s+(\d{1,3}(?:-\d{1,3})?)\s*p?/i;

function cleanLine(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/[•●▪◦–—−]/g, " ")
    .replace(/^\s*[\d]+[.)]\s*/, "")
    .replace(/^\s*[-*]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyHeader(line: string): boolean {
  if (!line || line.length > 80) return false;
  if (/^(uwagi|notatki|notes|rozgrzewka|warmup|cooling|cooldown)\b/i.test(line)) {
    return false;
  }
  if (/^(dzie[nń]|day|trening|sesja)(\s|$|[-–—:])/i.test(line)) return true;
  if (WEEKDAY_RE.test(line) || DAY_HEADER_RE.test(line)) return true;
  // Short title ending with colon
  if (/^[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9 ./-]{2,40}:$/.test(line)) return true;
  // ALL CAPS short Polish/English heading
  if (
    line.length <= 40 &&
    line === line.toUpperCase() &&
    /[A-ZĄĆĘŁŃÓŚŹŻ]/.test(line) &&
    !SETS_REPS_RE.test(line)
  ) {
    return true;
  }
  return false;
}

function parseSetsReps(line: string): {
  name: string;
  sets: number;
  reps: number;
} | null {
  const cleaned = cleanLine(line);
  if (!cleaned || cleaned.length < 2) return null;
  if (isLikelyHeader(cleaned.replace(/:$/, ""))) return null;

  const match = cleaned.match(SETS_REPS_RE);
  const coach = cleaned.match(SETS_P_RE);
  let sets = 3;
  let reps = 10;
  let name = cleaned;

  if (match) {
    sets = Math.min(20, Math.max(1, Number(match[1])));
    const repsRaw = match[2]!;
    const repsFirst = Number(repsRaw.split("-")[0]);
    reps = Number.isFinite(repsFirst)
      ? Math.min(100, Math.max(1, repsFirst))
      : 10;
    name = cleaned
      .replace(SETS_REPS_RE, " ")
      .replace(/\s+/g, " ")
      .trim();
  } else if (coach) {
    sets = Math.min(20, Math.max(1, Number(coach[1])));
    const repsFirst = Number(coach[2]!.split("-")[0]);
    reps = Number.isFinite(repsFirst)
      ? Math.min(100, Math.max(1, repsFirst))
      : 10;
    name = cleaned
      .replace(SETS_P_RE, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Drop trailing junk like "kg", "RPE 8"
  name = name
    .replace(/\b(rpe|rir)\s*\d+(\.\d+)?\b/gi, "")
    .replace(/\b\d+(\.\d+)?\s*kg\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (name.length < 2) return null;
  // Skip pure numbers / macros
  if (/^\d+([.,]\d+)?$/.test(name)) return null;
  if (/^(serie|powt[oó]rzenia|sets?|reps?)$/i.test(name)) return null;

  return { name, sets, reps };
}

function toExercise(name: string, sets: number, reps: number): WorkoutPlanExercise {
  const match = findBestCatalogMatch(name);
  return {
    id: randomUUID(),
    name: match?.name ?? name,
    categoryId: match?.categoryId ?? "shoulders",
    sets,
    reps,
  };
}

/**
 * Parsuje tekst planu (np. z Worda) na jeden lub wiele planów GymBrat.
 * Nagłówki dni → osobne plany; linie ćwiczeń → `sets`/`reps` (domyślnie 3×10).
 */
export function parseWorkoutPlansFromText(rawText: string): ParsedWorkoutPlanImport {
  const warnings: string[] = [];
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => cleanLine(l))
    .filter(Boolean);

  type Bucket = { title: string; exercises: WorkoutPlanExercise[] };
  const buckets: Bucket[] = [];
  let current: Bucket | null = null;

  const ensureBucket = (title: string) => {
    current = { title: title.replace(/:$/, "").trim() || "Plan z Worda", exercises: [] };
    buckets.push(current);
  };

  for (const line of lines) {
    const headerCandidate = line.replace(/:$/, "").trim();
    if (isLikelyHeader(headerCandidate) && !SETS_REPS_RE.test(line)) {
      ensureBucket(headerCandidate);
      continue;
    }

    const parsed = parseSetsReps(line);
    if (!parsed) continue;

    if (!current) {
      ensureBucket("Plan z Worda");
    }
    current!.exercises.push(toExercise(parsed.name, parsed.sets, parsed.reps));
  }

  const plans: WorkoutPlanPayload[] = buckets
    .filter((b) => b.exercises.length > 0)
    .map((b) => ({
      version: 2 as const,
      path: "custom" as const,
      planName: b.title.slice(0, 80),
      exercises: b.exercises,
      userCustomExerciseNames: [],
    }));

  if (plans.length === 0) {
    warnings.push(
      "Nie znaleziono ćwiczeń w pliku. Użyj nagłówków dni (np. „Dzień A”, „Push”) i linii typu „Wyciskanie 3x10”.",
    );
  } else if (plans.length > 1) {
    warnings.push(
      `Wykryto ${plans.length} dni/planów — każdy zostanie zapisany jako osobny plan w aplikacji.`,
    );
  }

  return { plans, warnings };
}

export async function parseWorkoutPlansFromDocx(
  buffer: Buffer,
): Promise<ParsedWorkoutPlanImport> {
  const result = await mammoth.extractRawText({ buffer });
  const text = (result.value ?? "").trim();
  if (!text) {
    return {
      plans: [],
      warnings: ["Plik Word jest pusty albo nie udało się odczytać tekstu."],
    };
  }
  const parsed = parseWorkoutPlansFromText(text);
  if (result.messages?.length) {
    parsed.warnings.push(
      ...result.messages
        .slice(0, 3)
        .map((m) => m.message)
        .filter(Boolean),
    );
  }
  return parsed;
}

/** Stary format Word (.doc) — OLE binary. */
export async function parseWorkoutPlansFromDoc(
  buffer: Buffer,
): Promise<ParsedWorkoutPlanImport> {
  const WordExtractor = (await import("word-extractor")).default;
  const extractor = new WordExtractor();
  const extracted = await extractor.extract(buffer);
  const body = String(extracted.getBody?.() ?? "").trim();
  const headers = String(extracted.getHeaders?.() ?? "").trim();
  const text = [headers, body].filter(Boolean).join("\n").trim();
  if (!text) {
    return {
      plans: [],
      warnings: [
        "Nie udało się odczytać tekstu z pliku .doc. Zapisz dokument jako .docx w Wordzie i wgraj ponownie.",
      ],
    };
  }
  return parseWorkoutPlansFromText(text);
}
