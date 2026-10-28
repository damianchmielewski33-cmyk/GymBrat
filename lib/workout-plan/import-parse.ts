import "server-only";

import { parseWorkoutPlansFromDoc, parseWorkoutPlansFromDocx } from "@/lib/docx/workout-plan-import";
import { parseWorkoutPlansFromXlsx } from "@/lib/excel/workout-plan-import";
import { parseWorkoutPlansFromPdf } from "@/lib/pdf/workout-plan-import";
import {
  detectWorkoutPlanFileKind,
  type WorkoutPlanFileKind,
} from "@/lib/workout-plan-file-kind";
import type { WorkoutPlanPayload } from "@/lib/workout-plan-types";
import { bestExerciseNameMatch } from "@/lib/workout-plan/match-exercise-name";
import type { CatalogExercise } from "@/lib/workout-exercise-catalog";

/** high = pewne; name_check = sprawdź nazwę; low = sprawdź cały wiersz. */
export type ImportConfidence = "high" | "name_check" | "low";

export type PreviewExercise = WorkoutPlanPayload["exercises"][number] & {
  confidence: ImportConfidence;
  matchedCatalogId?: string | null;
  matchedCatalogName?: string | null;
  selected: boolean;
  reviewed: boolean;
};

export type PreviewDay = {
  planName: string;
  selected: boolean;
  exercises: PreviewExercise[];
};

async function parseByKind(kind: WorkoutPlanFileKind, buffer: Buffer) {
  if (kind === "docx") return parseWorkoutPlansFromDocx(buffer);
  if (kind === "doc") return parseWorkoutPlansFromDoc(buffer);
  if (kind === "pdf") return parseWorkoutPlansFromPdf(buffer);
  return parseWorkoutPlansFromXlsx(buffer);
}

export async function parseWorkoutPlanUpload(args: {
  buffer: Buffer;
  fileName: string;
  mime: string;
  catalog: CatalogExercise[];
}): Promise<
  | {
      ok: true;
      kind: WorkoutPlanFileKind;
      warnings: string[];
      days: PreviewDay[];
    }
  | { ok: false; error: string; warnings?: string[]; debug?: unknown }
> {
  let kind = detectWorkoutPlanFileKind({
    name: args.fileName,
    mime: args.mime,
    buffer: args.buffer,
  });

  if (!kind) {
    return {
      ok: false,
      error:
        "Nie rozpoznano pliku. Wybierz .doc / .docx (Word), .xlsx (Excel) albo .pdf. Na Androidzie: Pliki → Pobrane.",
      debug: {
        name: args.fileName || null,
        mime: args.mime || null,
        bytes: args.buffer.length,
      },
    };
  }

  let parsed;
  try {
    parsed = await parseByKind(kind, args.buffer);
    if (parsed.plans.length === 0 && kind === "doc") {
      const asXlsx = parseWorkoutPlansFromXlsx(args.buffer);
      if (asXlsx.plans.length > 0) {
        parsed = asXlsx;
        kind = "xlsx";
      }
    } else if (parsed.plans.length === 0 && kind === "xlsx") {
      try {
        const asDocx = await parseWorkoutPlansFromDocx(args.buffer);
        if (asDocx.plans.length > 0) {
          parsed = asDocx;
          kind = "docx";
        } else {
          const asDoc = await parseWorkoutPlansFromDoc(args.buffer);
          if (asDoc.plans.length > 0) {
            parsed = asDoc;
            kind = "doc";
          }
        }
      } catch {
        /* keep */
      }
    }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Nie udało się odczytać pliku.",
    };
  }

  if (parsed.plans.length === 0) {
    return {
      ok: false,
      error: parsed.warnings[0] ?? "Nie znaleziono ćwiczeń w dokumencie.",
      warnings: parsed.warnings,
    };
  }

  const isStructured = kind === "xlsx";
  const days: PreviewDay[] = parsed.plans.map((plan) => ({
    planName: plan.planName,
    selected: true,
    exercises: plan.exercises.map((ex) => {
      const match = bestExerciseNameMatch(ex.name, args.catalog);
      const setsOk =
        Number.isFinite(ex.sets) && ex.sets >= 1 && ex.sets <= 20;
      const repsOk = Number.isFinite(ex.reps) && ex.reps >= 1;
      let confidence: ImportConfidence;

      if (!setsOk || !repsOk) {
        confidence = "low";
      } else if (match && match.score >= 92) {
        confidence = isStructured ? "high" : match.score >= 100 ? "high" : "name_check";
      } else if (match && match.score >= 70) {
        confidence = "name_check";
      } else if (!match) {
        confidence = "name_check";
      } else if (!isStructured) {
        confidence = "low";
      } else {
        confidence = "high";
      }

      const useAtlasName = match && match.score >= 80;
      return {
        ...ex,
        name: useAtlasName ? match!.exercise.name : ex.name,
        categoryId: useAtlasName
          ? match!.exercise.categoryId
          : ex.categoryId,
        confidence,
        matchedCatalogId: match?.exercise.id ?? null,
        matchedCatalogName: match?.exercise.name ?? null,
        selected: confidence !== "low",
        reviewed: confidence === "high",
      };
    }),
  }));

  return { ok: true, kind, warnings: parsed.warnings, days };
}
