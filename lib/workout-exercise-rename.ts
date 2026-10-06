import type { WorkoutPlanPayload } from "@/lib/workout-plan-types";

export type ExerciseRename = {
  exerciseId: string;
  fromName: string;
  toName: string;
};

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Wykrywa zmiany nazw przy tym samym id ćwiczenia w planie.
 * Progres i historia są powiązane z nazwą — rename musi iść razem z migracją sesji.
 */
export function collectExerciseRenames(
  previous: WorkoutPlanPayload,
  next: WorkoutPlanPayload,
): ExerciseRename[] {
  const prevById = new Map(
    previous.exercises.map((e) => [e.id, normalizeName(e.name)] as const),
  );
  const out: ExerciseRename[] = [];
  for (const ex of next.exercises) {
    const prevName = prevById.get(ex.id);
    if (prevName == null) continue;
    const nextName = normalizeName(ex.name);
    if (!nextName || prevName === nextName) continue;
    out.push({
      exerciseId: ex.id,
      fromName: prevName,
      toName: nextName,
    });
  }
  return out;
}

/** Mapa id ćwiczenia z planu → aktualna nazwa (do synchronizacji historii). */
export function planExerciseNameById(
  plan: WorkoutPlanPayload,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const ex of plan.exercises) {
    const name = normalizeName(ex.name);
    if (ex.id && name) map.set(ex.id, name);
  }
  return map;
}

/** Aktualizuje listę własnych nazw ćwiczeń po rename. */
export function applyRenamesToCustomNames(
  names: string[],
  renames: ExerciseRename[],
): string[] {
  if (!renames.length) return names;
  const byFrom = new Map(
    renames.map((r) => [normalizeName(r.fromName), r.toName] as const),
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const n = normalizeName(raw);
    const mapped = byFrom.get(n) ?? n;
    if (!mapped || seen.has(mapped)) continue;
    seen.add(mapped);
    out.push(mapped);
  }
  return out;
}

type MutableExercise = {
  id?: unknown;
  name?: unknown;
  [key: string]: unknown;
};

/**
 * Podmienia nazwy ćwiczeń w payloadzie sesji (completed / active).
 * 1) Po id z planu (leczy też wcześniejsze rename bez migracji).
 * 2) Po dokładnej starej nazwie — dla sesji bez id / freestyle (jedno przejście, bezpieczne przy swapie).
 */
export function renameExercisesInPayload(
  payload: unknown,
  renames: ExerciseRename[],
  nameById: Map<string, string> = new Map(),
): { changed: boolean; payload: unknown } {
  if (
    (!renames.length && nameById.size === 0) ||
    !payload ||
    typeof payload !== "object"
  ) {
    return { changed: false, payload };
  }

  const root = payload as Record<string, unknown>;
  if (!Array.isArray(root.exercises)) {
    return { changed: false, payload };
  }

  const byId = new Map(nameById);
  for (const r of renames) {
    byId.set(r.exerciseId, r.toName);
  }
  const byFromName = new Map(
    renames.map((r) => [normalizeName(r.fromName), r.toName] as const),
  );

  let changed = false;
  const exercises = (root.exercises as MutableExercise[]).map((raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const id = typeof raw.id === "string" ? raw.id : "";
    const currentName =
      typeof raw.name === "string" ? normalizeName(raw.name) : "";

    let nextName: string | undefined;
    if (id && byId.has(id)) {
      nextName = byId.get(id);
    } else if (currentName && byFromName.has(currentName)) {
      nextName = byFromName.get(currentName);
    }

    if (!nextName || nextName === currentName) return raw;
    changed = true;
    return { ...raw, name: nextName };
  });

  if (!changed) return { changed: false, payload };
  return { changed: true, payload: { ...root, exercises } };
}

/** Parsuje JSON sesji, stosuje rename i zwraca nowy string albo null gdy bez zmian / błąd. */
export function rewriteSessionExercisesJson(
  json: string,
  renames: ExerciseRename[],
  nameById: Map<string, string> = new Map(),
): string | null {
  if (!renames.length && nameById.size === 0) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    const { changed, payload } = renameExercisesInPayload(
      parsed,
      renames,
      nameById,
    );
    if (!changed) return null;
    return JSON.stringify(payload);
  } catch {
    return null;
  }
}
