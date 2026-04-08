import * as XLSX from "xlsx";

import type { ImportBodyReportRow } from "@/lib/body-reports";

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
  const set = new Map<string, string>();
  for (const k of keys) set.set(normKey(k), k);
  for (const c of candidates) {
    const found = set.get(normKey(c));
    if (found) return found;
  }
  // Fuzzy contains match
  const normKeys = keys.map((k) => ({ raw: k, n: normKey(k) }));
  for (const c of candidates) {
    const cn = normKey(c);
    const match = normKeys.find((k) => k.n.includes(cn) || cn.includes(k.n));
    if (match) return match.raw;
  }
  return null;
}

function parseNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const raw = String(v).trim();
  if (!raw) return null;

  // Handle values like "72(72,5)" -> take the value inside parentheses.
  const paren = raw.match(/\(([^)]+)\)/);
  const base = (paren?.[1] ?? raw).trim();

  const match = base.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function parseDate(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "number") {
    // Excel date serial
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H ?? 0, d.M ?? 0, d.S ?? 0));
  }
  let s = String(v ?? "").trim();
  if (!s) return null;
  s = s.replace(/=+$/, "").trim();

  // Try ISO / local formats
  const asIso = new Date(s);
  if (!Number.isNaN(asIso.getTime())) return asIso;

  // Try dd.mm.yyyy or dd/mm/yyyy
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const d = new Date(yyyy, mm - 1, dd);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Try US mm/dd/yyyy
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const mm = Number(us[1]);
    const dd = Number(us[2]);
    const yyyy = Number(us[3]);
    const d = new Date(yyyy, mm - 1, dd);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parseTakNie(v: unknown): string | null {
  const u = String(v ?? "").trim().toUpperCase();
  if (u === "TAK" || u === "YES" || u === "1") return "tak";
  if (u === "NIE" || u === "NO" || u === "0") return "nie";
  return null;
}

function textOrNull(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export function parseBodyReportsFromXlsx(buffer: ArrayBuffer): {
  rows: ImportBodyReportRow[];
  warnings: string[];
} {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName =
    wb.SheetNames.find((n) => normKey(n) === "raport") ?? wb.SheetNames[0];
  if (!sheetName) return { rows: [], warnings: ["Brak arkuszy w pliku Excel."] };

  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    blankrows: false,
    raw: true,
  });
  if (!matrix.length) return { rows: [], warnings: ["Arkusz jest pusty."] };

  // Find header row (exports often have 1+ description rows above the real header)
  const headerNeedles = ["data", "data raportu", "waga", "pas", "klatka", "udo"];
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(matrix.length, 25); i++) {
    const row = matrix[i] ?? [];
    const cells = row.map((c) => normKey(String(c ?? ""))).filter(Boolean);
    const score = headerNeedles.filter((n) => cells.some((c) => c.includes(n))).length;
    if (score >= 3) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) {
    return {
      rows: [],
      warnings: ["Nie udało się wykryć wiersza nagłówków w arkuszu. Sprawdź, czy arkusz zawiera kolumny typu: Data, Waga, Pas."],
    };
  }

  const headerRow = (matrix[headerRowIdx] ?? []).map((c) => String(c ?? "").trim());
  const headers = headerRow.map((h, idx) => (h ? h : `__EMPTY_${idx}`));

  const ref = ws["!ref"];
  if (!ref) {
    return {
      rows: [],
      warnings: ["Arkusz nie ma zakresu `!ref` (nietypowy plik Excel)."],
    };
  }
  const range = XLSX.utils.decode_range(ref);
  range.s.r = headerRowIdx + 1; // first data row (0-based)
  range.s.c = 0;

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    header: headers,
    range,
    defval: null,
    raw: true,
    blankrows: false,
  });
  if (!json.length) return { rows: [], warnings: ["Arkusz nie zawiera danych pod nagłówkami."] };

  const keys = Object.keys(json[0] ?? {});
  const dateKey =
    pickKey(keys, ["data raportu", "data", "date", "dzien", "dzień", "timestamp", "czas"]) ??
    null;

  const weightKey = pickKey(keys, ["waga", "masa", "weight", "weight kg", "kg"]);
  const waistKey = pickKey(keys, ["pas", "talia", "waist", "waist cm"]);
  const chestKey = pickKey(keys, ["klatka", "chest", "chest cm"]);
  const thighKey = pickKey(keys, ["udo", "thigh", "thigh cm"]);
  const trainingEnergyKey = pickKey(keys, [
    "energia na treningu",
    "energia podczas cwiczen",
    "energia podczas ćwiczeń",
    "energia trening",
    "training energy",
  ]);
  const sleepKey = pickKey(keys, ["jakosc snu", "jakość snu", "sen", "sleep quality"]);
  const dayEnergyKey = pickKey(keys, ["energia w ciagu dnia", "energia w ciągu dnia", "energia dzien", "energia dzień"]);
  const digestionKey = pickKey(keys, ["trawienie", "digestion"]);
  const cardioKey = pickKey(keys, [
    "czy cardio zrealizowane",
    "cardio zrealizowane",
    "cardio zgodnie",
  ]);
  const dietKey = pickKey(keys, ["czy dieta zgodnie", "dieta zgodnie"]);
  const trainingComplianceKey = pickKey(keys, [
    "czy treningi zgodnie",
    "czy trening zgodnie",
    "treningi zgodnie",
    "trening zgodnie z zaleceniami",
  ]);
  const complianceNotesKey = pickKey(keys, [
    "jesli w poprzednich 3 polach",
    "jeśli w poprzednich 3 polach",
    "czego nie udalo sie zrealizowac",
    "czego nie udało się zrealizować",
  ]);
  const additionalInfoKey = pickKey(keys, [
    "informacje dodatkowe",
    "dodatkowe informacje",
  ]);

  const warnings: string[] = [];
  if (!dateKey) warnings.push('Nie znaleziono kolumny z datą (np. "Data"). Import użyje dzisiejszej daty dla wszystkich wierszy.');

  const rows: ImportBodyReportRow[] = [];
  for (const r of json) {
    const createdAt = (dateKey ? parseDate(r[dateKey]) : null) ?? new Date();
    if (Number.isNaN(createdAt.getTime())) continue;

    const row: ImportBodyReportRow = {
      createdAt,
      weightKg: weightKey ? parseNumber(r[weightKey]) : null,
      waistCm: waistKey ? parseNumber(r[waistKey]) : null,
      chestCm: chestKey ? parseNumber(r[chestKey]) : null,
      thighCm: thighKey ? parseNumber(r[thighKey]) : null,
      trainingEnergy: trainingEnergyKey ? parseNumber(r[trainingEnergyKey]) : null,
      sleepQuality: sleepKey ? parseNumber(r[sleepKey]) : null,
      dayEnergy: dayEnergyKey ? parseNumber(r[dayEnergyKey]) : null,
      digestionScore: digestionKey ? parseNumber(r[digestionKey]) : null,
      cardioCompliance: cardioKey ? parseTakNie(r[cardioKey]) : null,
      dietCompliance: dietKey ? parseTakNie(r[dietKey]) : null,
      trainingCompliance: trainingComplianceKey ? parseTakNie(r[trainingComplianceKey]) : null,
      complianceNotes: complianceNotesKey ? textOrNull(r[complianceNotesKey]) : null,
      additionalInfo: additionalInfoKey ? textOrNull(r[additionalInfoKey]) : null,
    };

    // Skip fully empty measurement rows.
    const hasAny =
      row.weightKg != null ||
      row.waistCm != null ||
      row.chestCm != null ||
      row.thighCm != null ||
      row.trainingEnergy != null ||
      row.sleepQuality != null ||
      row.dayEnergy != null ||
      row.digestionScore != null ||
      row.cardioCompliance != null ||
      row.dietCompliance != null ||
      row.trainingCompliance != null ||
      row.complianceNotes != null ||
      row.additionalInfo != null;
    if (!hasAny) continue;

    rows.push(row);
  }

  return { rows, warnings };
}

