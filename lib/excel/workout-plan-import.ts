import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { findBestCatalogMatch } from "@/lib/workout-exercise-catalog";
import {
  parseWorkoutPlansFromText,
  type ParsedWorkoutPlanImport,
} from "@/lib/docx/workout-plan-import";
import type { WorkoutPlanExercise, WorkoutPlanPayload } from "@/lib/workout-plan-types";

const SETS_REPS_CELL_RE = /(\d{1,2})\s*[x×]\s*(\d{1,3}(?:-\d{1,3})?)/i;

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

function parseSetsRepsCell(v: unknown): { sets: number; reps: number } | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  const m = s.match(SETS_REPS_CELL_RE);
  if (!m) return null;
  const sets = Math.min(20, Math.max(1, Number(m[1])));
  const repsFirst = Number(m[2]!.split("-")[0]);
  const reps = Number.isFinite(repsFirst)
    ? Math.min(100, Math.max(1, repsFirst))
    : 10;
  return { sets, reps };
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

function cellText(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/\u00a0/g, " ").trim();
}

function sheetToTextLines(sheet: XLSX.WorkSheet, sheetName: string): string {
  const aoa = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(
    sheet,
    { header: 1, defval: "", raw: false },
  );
  const lines: string[] = [];
  // Nazwa arkusza jako nagłówek dnia tylko gdy wygląda jak dzień (nie „Sheet1”/„Plan”)
  const sheetTitle = sheetName.trim();
  if (
    sheetTitle &&
    !/^(sheet\s*\d+|arkusz\s*\d+|plan|lista|tabela)$/i.test(sheetTitle)
  ) {
    lines.push(sheetTitle);
  }
  for (const row of aoa) {
    if (!Array.isArray(row)) continue;
    const parts = row.map(cellText).filter(Boolean);
    if (parts.length === 0) continue;
    // Scal komórki w jedną linię: „Przysiady”, „4”, „8” → „Przysiady 4x8”
    if (
      parts.length >= 3 &&
      /^\d{1,2}$/.test(parts[1]!) &&
      /^\d{1,3}(?:-\d{1,3})?$/.test(parts[2]!)
    ) {
      lines.push(`${parts[0]} ${parts[1]}x${parts[2]}`);
      continue;
    }
    lines.push(parts.join(" "));
  }
  return lines.join("\n");
}

function plansFromRows(
  rows: Record<string, unknown>[],
  sheetName: string,
): WorkoutPlanPayload[] {
  if (rows.length === 0) return [];

  const keys = Object.keys(rows[0] ?? {}).filter(
    (k) => !/^__empty/i.test(normKey(k).replace(/\s/g, "")),
  );
  if (keys.length === 0) return [];

  const dayKey = pickKey(keys, [
    "dzień",
    "dzien",
    "day",
    "sesja",
    "trening",
    "blok",
  ]);
  const nameKey = pickKey(keys, [
    "ćwiczenie",
    "cwiczenie",
    "exercise",
    "nazwa",
    "name",
    "ruch",
    "exercise name",
  ]);
  const setsKey = pickKey(keys, [
    "serie",
    "sets",
    "serii",
    "ilosc serii",
    "ilość serii",
  ]);
  const repsKey = pickKey(keys, [
    "powtórzenia",
    "powtorzenia",
    "reps",
    "powt",
    "powtórzeń",
    "powtorzen",
  ]);
  const comboKey = pickKey(keys, [
    "serie x powtorzenia",
    "serie x powtórzenia",
    "sets x reps",
    "seria x powt",
    "s x r",
    "volume",
  ]);

  const resolveSetsReps = (row: Record<string, unknown>) => {
    const fromCombo = comboKey ? parseSetsRepsCell(row[comboKey]) : null;
    if (fromCombo) return fromCombo;
    // Szukaj 4x8 w dowolnej komórce wiersza
    for (const k of keys) {
      const parsed = parseSetsRepsCell(row[k]);
      if (parsed) return parsed;
    }
    return {
      sets: parseNum(setsKey ? row[setsKey] : null) ?? 3,
      reps: parseNum(repsKey ? row[repsKey] : null) ?? 10,
    };
  };

  const out: WorkoutPlanPayload[] = [];

  if (dayKey && nameKey) {
    const byDay = new Map<string, WorkoutPlanExercise[]>();
    for (const row of rows) {
      const day = cellText(row[dayKey]) || sheetName;
      const name = cellText(row[nameKey]);
      if (!name || /^(cwiczenie|exercise|nazwa)$/i.test(normKey(name))) continue;
      const { sets, reps } = resolveSetsReps(row);
      const list = byDay.get(day) ?? [];
      list.push(toExercise(name, sets, reps));
      byDay.set(day, list);
    }
    for (const [day, exercises] of byDay) {
      if (exercises.length === 0) continue;
      out.push({
        version: 2,
        path: "custom",
        planName: day.slice(0, 80),
        exercises,
        userCustomExerciseNames: [],
      });
    }
    return out;
  }

  if (nameKey) {
    const exercises: WorkoutPlanExercise[] = [];
    for (const row of rows) {
      const name = cellText(row[nameKey]);
      if (!name || /^(cwiczenie|exercise|nazwa)$/i.test(normKey(name))) continue;
      const { sets, reps } = resolveSetsReps(row);
      exercises.push(toExercise(name, sets, reps));
    }
    if (exercises.length > 0) {
      out.push({
        version: 2,
        path: "custom",
        planName: sheetName.slice(0, 80) || "Plan z Excela",
        exercises,
        userCustomExerciseNames: [],
      });
    }
    return out;
  }

  return out;
}

/**
 * Gdy pierwsza „nagłówkowa” linia to tytuł planu, sheet_to_json bierze złe klucze.
 * Przeszukaj pierwsze wiersze AOA i zbuduj rekordy od właściwego nagłówka.
 */
function rowsFromBestHeader(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const aoa = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(
    sheet,
    { header: 1, defval: "", raw: false },
  );
  if (!aoa.length) return [];

  const headerHints = [
    "cwiczenie",
    "exercise",
    "nazwa",
    "dzień",
    "dzien",
    "day",
    "serie",
    "sets",
    "powtorzenia",
    "powtórzenia",
    "reps",
  ];

  let headerIdx = 0;
  for (let i = 0; i < Math.min(aoa.length, 12); i++) {
    const row = aoa[i] ?? [];
    const joined = row.map(cellText).map(normKey).join(" ");
    if (headerHints.some((h) => joined.includes(normKey(h)))) {
      headerIdx = i;
      break;
    }
  }

  const headerRow = (aoa[headerIdx] ?? []).map((c, idx) => {
    const t = cellText(c);
    return t || `Kolumna ${idx + 1}`;
  });
  const rows: Record<string, unknown>[] = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const raw = aoa[i] ?? [];
    if (raw.every((c) => !cellText(c))) continue;
    const rec: Record<string, unknown> = {};
    headerRow.forEach((h, idx) => {
      rec[h] = raw[idx] ?? "";
    });
    rows.push(rec);
  }
  return rows;
}

/**
 * Import planu z Excela:
 * - każdy arkusz = osobny dzień/plan, kolumny: ćwiczenie / serie / powtórzenia
 * - albo jeden arkusz z kolumną „dzień”
 * - albo arkusz bez nagłówków — wtedy traktujemy jak tekst (wiersze → linie)
 */
export function parseWorkoutPlansFromXlsx(buffer: Buffer): ParsedWorkoutPlanImport {
  const warnings: string[] = [];
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  } catch (err) {
    return {
      plans: [],
      warnings: [
        err instanceof Error
          ? `Nie udało się otworzyć Excela: ${err.message}`
          : "Nie udało się otworzyć pliku Excel.",
      ],
    };
  }

  if (!wb.SheetNames.length) {
    return { plans: [], warnings: ["Plik Excel nie ma arkuszy."] };
  }

  const plans: WorkoutPlanPayload[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    // 1) Inteligentne nagłówki (tytuł w 1. wierszu nie psuje kolumn)
    const smartRows = rowsFromBestHeader(sheet);
    let sheetPlans = plansFromRows(smartRows, sheetName);

    // 2) Klasyczny sheet_to_json
    if (sheetPlans.length === 0) {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
      });
      sheetPlans = plansFromRows(rows, sheetName);
    }

    // 3) Tekst: scal komórki → linie jak z Worda („Przysiady 4x8”)
    if (sheetPlans.length === 0) {
      const text = sheetToTextLines(sheet, sheetName);
      const parsed = parseWorkoutPlansFromText(text);
      sheetPlans = parsed.plans;
      warnings.push(...parsed.warnings);
    }

    plans.push(...sheetPlans);
  }

  const nonEmpty = plans.filter((p) => p.exercises.length > 0);
  if (nonEmpty.length === 0) {
    warnings.push(
      "Nie znaleziono ćwiczeń w Excelu. Użyj kolumn: dzień, ćwiczenie, serie, powtórzenia — albo w komórkach wpisz „Przysiady 4x8”.",
    );
  } else if (nonEmpty.length > 1) {
    warnings.push(
      `Wykryto ${nonEmpty.length} dni/planów — każdy zostanie zapisany osobno.`,
    );
  }

  return { plans: nonEmpty, warnings: [...new Set(warnings)] };
}
