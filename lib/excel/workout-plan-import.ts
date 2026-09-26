import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { findBestCatalogMatch } from "@/lib/workout-exercise-catalog";
import {
  parseWorkoutPlansFromText,
  type ParsedWorkoutPlanImport,
} from "@/lib/docx/workout-plan-import";
import type { WorkoutPlanExercise, WorkoutPlanPayload } from "@/lib/workout-plan-types";

function normKey(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[\s._-]+/g, " ")
    .trim();
}

function pickKey(keys: string[], candidates: string[]): string | null {
  const set = new Map(keys.map((k) => [normKey(k), k]));
  for (const c of candidates) {
    const found = set.get(normKey(c));
    if (found) return found;
  }
  const normKeys = keys.map((k) => ({ raw: k, n: normKey(k) }));
  for (const c of candidates) {
    const cn = normKey(c);
    const match = normKeys.find((k) => k.n.includes(cn) || cn.includes(k.n));
    if (match) return match.raw;
  }
  return null;
}

function parseNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const m = String(v).replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

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

/**
 * Import planu z Excela:
 * - każdy arkusz = osobny dzień/plan, kolumny: ćwiczenie / serie / powtórzenia
 * - albo jeden arkusz z kolumną „dzień”
 * - albo arkusz bez nagłówków — wtedy traktujemy jak tekst (wiersze → linie)
 */
export function parseWorkoutPlansFromXlsx(buffer: Buffer): ParsedWorkoutPlanImport {
  const warnings: string[] = [];
  const wb = XLSX.read(buffer, { type: "buffer" });
  if (!wb.SheetNames.length) {
    return { plans: [], warnings: ["Plik Excel nie ma arkuszy."] };
  }

  const plans: WorkoutPlanPayload[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });

    if (rows.length === 0) {
      // Fallback: plain text lines from sheet
      const text = XLSX.utils.sheet_to_csv(sheet);
      const parsed = parseWorkoutPlansFromText(
        [`${sheetName}`, text].join("\n"),
      );
      plans.push(...parsed.plans);
      warnings.push(...parsed.warnings);
      continue;
    }

    const keys = Object.keys(rows[0] ?? {});
    const dayKey = pickKey(keys, ["dzień", "dzien", "day", "sesja", "trening"]);
    const nameKey = pickKey(keys, [
      "ćwiczenie",
      "cwiczenie",
      "exercise",
      "nazwa",
      "name",
      "ruch",
    ]);
    const setsKey = pickKey(keys, ["serie", "sets", "serii", "ilosc serii"]);
    const repsKey = pickKey(keys, [
      "powtórzenia",
      "powtorzenia",
      "reps",
      "powt",
      "powtórzeń",
    ]);

    // Kolumna dnia → grupuj
    if (dayKey && nameKey) {
      const byDay = new Map<string, WorkoutPlanExercise[]>();
      for (const row of rows) {
        const day = String(row[dayKey] ?? "").trim() || sheetName;
        const name = String(row[nameKey] ?? "").trim();
        if (!name) continue;
        const sets = parseNum(setsKey ? row[setsKey] : null) ?? 3;
        const reps = parseNum(repsKey ? row[repsKey] : null) ?? 10;
        const list = byDay.get(day) ?? [];
        list.push(toExercise(name, sets, reps));
        byDay.set(day, list);
      }
      for (const [day, exercises] of byDay) {
        if (exercises.length === 0) continue;
        plans.push({
          version: 2,
          path: "custom",
          planName: day.slice(0, 80),
          exercises,
          userCustomExerciseNames: [],
        });
      }
      continue;
    }

    // Arkusz = dzień, kolumna ćwiczenia
    if (nameKey) {
      const exercises: WorkoutPlanExercise[] = [];
      for (const row of rows) {
        const name = String(row[nameKey] ?? "").trim();
        if (!name) continue;
        const sets = parseNum(setsKey ? row[setsKey] : null) ?? 3;
        const reps = parseNum(repsKey ? row[repsKey] : null) ?? 10;
        exercises.push(toExercise(name, sets, reps));
      }
      if (exercises.length > 0) {
        plans.push({
          version: 2,
          path: "custom",
          planName: sheetName.slice(0, 80) || "Plan z Excela",
          exercises,
          userCustomExerciseNames: [],
        });
      }
      continue;
    }

    // Brak rozpoznanych kolumn — spróbuj tekstowo (pierwsza kolumna = linia)
    const firstCol = keys[0];
    if (firstCol) {
      const lines = rows
        .map((r) => String(r[firstCol] ?? "").trim())
        .filter(Boolean);
      const parsed = parseWorkoutPlansFromText([sheetName, ...lines].join("\n"));
      plans.push(...parsed.plans);
    }
  }

  // Deduplicate empty
  const nonEmpty = plans.filter((p) => p.exercises.length > 0);
  if (nonEmpty.length === 0) {
    warnings.push(
      "Nie znaleziono ćwiczeń w Excelu. Użyj kolumn: dzień, ćwiczenie, serie, powtórzenia — albo osobny arkusz na dzień.",
    );
  } else if (nonEmpty.length > 1) {
    warnings.push(
      `Wykryto ${nonEmpty.length} dni/planów — każdy zostanie zapisany osobno.`,
    );
  }

  return { plans: nonEmpty, warnings };
}
