import { randomUUID } from "node:crypto";
import { findBestCatalogMatch } from "@/lib/workout-exercise-catalog";
import {
  parseWorkoutPlansFromText,
  type ParsedWorkoutPlanImport,
} from "@/lib/docx/workout-plan-import";
import type { WorkoutPlanExercise, WorkoutPlanPayload } from "@/lib/workout-plan-types";

const DAY_HEADER_LINE =
  /^(push\s*[ab12]?|pull|nogi|klatka\s*\+\s*(?:ramiona|łapy|lapy)|barki\s*\+\s*plecy)\b/i;

const NOISE_LINE =
  /^(obciążenie|obciazenie|ćwiczenie|cwiczenie|serie\/?\s*powt[oó]rzenia|rir|tempo|tydzień\s*\d+|schemat treningowy|set\s*\d+|lub dowolne)/i;

const SET_REP_RE = /(\d{1,2})\s*s\s+(\d{1,3})(?:-(\d{1,3}))?\s*p?/gi;
const DASH_REPS_RE = /(?:^|\s)-(\d{1,3})\s*p\b/gi;
const X_REPS_RE = /(\d{1,2})\s*[x×]\s*(\d{1,3})(?:\s*\/\s*\d{1,3})*/gi;
const P_TIMES_RE = /(\d{1,3})\s*p\s*[x×]\s*(\d{1,2})/gi;
const HOLD_TIMES_RE = /(\d{2,3})\s*s\s*[x×]\s*(\d{1,2})/gi;

function toExercise(name: string, sets: number, reps: number): WorkoutPlanExercise {
  const match = findBestCatalogMatch(name);
  return {
    id: randomUUID(),
    name: match?.name ?? name,
    categoryId: match?.categoryId ?? "shoulders",
    sets: Math.min(20, Math.max(1, Math.round(sets))),
    reps: Math.min(100, Math.max(1, Math.round(reps))),
  };
}

function normalizeCoachText(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .replace(/Klatka\s*\+\s*\n\s*(Ramiona|Łapy|Lapy)/gi, "Klatka + $1")
    .replace(/Barki\s*\+\s*\n\s*Plecy/gi, "Barki + Plecy")
    .replace(/Serie\s*\/\s*\n\s*Powt[oó]rzenia/gi, "Serie/Powtórzenia")
    .replace(/Tydzień\s*\d+/gi, " ")
    .replace(/Obciąże\s*\n\s*nie|Obciążen\s*\n\s*ie|Obciążeni\s*\n\s*e/gi, " ")
    .replace(/\bObciążenie\b/gi, " ")
    .replace(/\bĆwiczenie\b/gi, " ")
    .replace(/Serie\/?\s*Powt[oó]rzenia/gi, " ")
    .replace(/\bTempo\b/gi, " ")
    .replace(/\bRIR\b/gi, " ");
}

function matchDayHeader(line: string): string | null {
  const t = line.replace(/:$/, "").trim();
  const m = t.match(DAY_HEADER_LINE);
  if (!m) return null;
  return (m[1] ?? t).replace(/\s+/g, " ").trim();
}

function isExerciseStart(line: string): { rest: string } | null {
  // „2s 8-10p” to seria, nie numer ćwiczenia
  if (/^\d{1,2}\s*s\s+\d/i.test(line)) return null;
  if (/^\d{1,2}\/\d/.test(line)) return null;
  if (/^\d{1,2}$/.test(line)) return { rest: "" };
  // 2a Deadbug / 1 Allachy / 2 Bench Press
  const m = line.match(/^(\d{1,2})([a-z])?(?![0-9\/])\s+(.+)$/i);
  if (!m) return null;
  if (m[2] && /^s$/i.test(m[2]) && /^\d/.test(m[3]!)) return null;
  return { rest: m[3]!.trim() };
}

function parseSetsRepsFromBlob(blob: string): { sets: number; reps: number } {
  let sets = 0;
  let reps = 0;

  for (const m of blob.matchAll(SET_REP_RE)) {
    sets += Number(m[1]);
    if (!reps) reps = Number(m[2]);
  }
  for (const m of blob.matchAll(DASH_REPS_RE)) {
    if (!sets) sets = 1;
    if (!reps) reps = Number(m[1]);
  }
  for (const m of blob.matchAll(X_REPS_RE)) {
    if (!sets) sets = Number(m[1]);
    if (!reps) reps = Number(m[2]);
  }
  for (const m of blob.matchAll(P_TIMES_RE)) {
    if (!sets) sets = Number(m[2]);
    if (!reps) reps = Number(m[1]);
  }
  for (const m of blob.matchAll(HOLD_TIMES_RE)) {
    if (!sets) sets = Number(m[2]);
    if (!reps) reps = Number(m[1]);
  }

  return {
    sets: sets || 3,
    reps: reps || 10,
  };
}

function stripPrescription(blob: string): string {
  return blob
    .replace(SET_REP_RE, " ")
    .replace(DASH_REPS_RE, " ")
    .replace(X_REPS_RE, " ")
    .replace(P_TIMES_RE, " ")
    .replace(HOLD_TIMES_RE, " ")
    .replace(/\b\d{4}\b/g, " ")
    .replace(/\b\d+\/\d+\b/g, " ")
    .replace(/\b[01]\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanExerciseName(name: string): string {
  return name
    .replace(/\b(rpe|rir)\s*\d+(\.\d+)?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tabele trenerów: „Push A”, ćwiczenia 1–7, zapis „2s 8-10p” / „1s 6-8p + 1s 8-10p”.
 */
export function parseCoachTablePlans(rawText: string): ParsedWorkoutPlanImport {
  const text = normalizeCoachText(rawText);
  const lines = text
    .split(/\n/)
    .map((l) => l.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((l) => !NOISE_LINE.test(l))
    .filter((l) => !/^prawie? autorskim|wszelkie materiały|deklarujesz zgodę/i.test(l));

  type Bucket = { title: string; exercises: WorkoutPlanExercise[] };
  const buckets: Bucket[] = [];
  let current: Bucket | null = null;
  let acc = "";

  const flush = () => {
    const blob = acc.replace(/\s+/g, " ").trim();
    acc = "";
    if (!blob || !current) return;
    const name = cleanExerciseName(stripPrescription(blob));
    if (name.length < 3) return;
    if (/^(push|pull|nogi|klatka|barki|tempo|przerwa|rir)/i.test(name) && name.length < 8) {
      return;
    }
    const { sets, reps } = parseSetsRepsFromBlob(blob);
    current.exercises.push(toExercise(name, sets, reps));
  };

  const startDay = (title: string) => {
    flush();
    current = { title: title.replace(/\s+/g, " ").trim(), exercises: [] };
    buckets.push(current);
  };

  for (const line of lines) {
    if (/^TEMPO TRENINGOWE/i.test(line) || /^Przerwa miedzy/i.test(line)) {
      flush();
      current = null;
      continue;
    }
    const day = matchDayHeader(line);
    if (day) {
      startDay(day);
      continue;
    }
    const start = isExerciseStart(line);
    if (start && current) {
      flush();
      acc = start.rest;
      continue;
    }
    if (current) {
      acc = acc ? `${acc} ${line}` : line;
    }
  }
  flush();

  // Brzuch: jeśli nie złapaliśmy dni tabeli, ale jest sekcja brzucha w surowym tekście
  const plans: WorkoutPlanPayload[] = buckets
    .filter((b) => b.exercises.length > 0)
    .map((b) => ({
      version: 2 as const,
      path: "custom" as const,
      planName: b.title.slice(0, 80),
      exercises: b.exercises,
      userCustomExerciseNames: [],
    }));

  const warnings: string[] = [];
  if (plans.length === 0) {
    warnings.push(
      "Nie znaleziono tabeli dni (Push / Pull / Nogi) w PDF. Sprawdź, czy plik ma ćwiczenia i serie (np. 2s 8-10p).",
    );
  } else if (plans.length > 1) {
    warnings.push(
      `Wykryto ${plans.length} dni/planów — każdy zostanie zapisany jako osobny plan.`,
    );
  }

  return { plans, warnings };
}

export async function extractPdfPlainText(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  const joined = Array.isArray(text) ? text.join("\n") : String(text ?? "");
  return joined.trim();
}

export async function parseWorkoutPlansFromPdf(
  buffer: Buffer,
): Promise<ParsedWorkoutPlanImport> {
  let text: string;
  try {
    text = await extractPdfPlainText(buffer);
  } catch (err) {
    return {
      plans: [],
      warnings: [
        err instanceof Error
          ? `Nie udało się odczytać PDF: ${err.message}`
          : "Nie udało się odczytać pliku PDF.",
      ],
    };
  }

  if (!text) {
    return {
      plans: [],
      warnings: [
        "PDF jest pusty albo to skan bez warstwy tekstu. Wgraj PDF z tekstem (nie samo zdjęcie).",
      ],
    };
  }

  const table = parseCoachTablePlans(text);
  if (table.plans.length > 0) return table;

  const fallback = parseWorkoutPlansFromText(text);
  if (fallback.plans.length > 0) return fallback;

  return {
    plans: [],
    warnings: [
      ...table.warnings,
      ...fallback.warnings,
    ].filter(Boolean),
  };
}
