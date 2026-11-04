import type { WorkoutExerciseState } from "@/components/workout/types";

/**
 * Czy ćwiczenie zwykle wykonuje się z dodatkowym obciążeniem (US13 / Z62).
 * Dla takich ćwiczeń zapis serii z 0 kg wymaga świadomego potwierdzenia „masa ciała”.
 *
 * Kolejność: dowód z danych (jakakolwiek seria / ostatnia sesja / sugestia > 0 kg)
 * > ćwiczenie z masą ciała po nazwie > sprzęt z obciążeniem po nazwie.
 */
function norm(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l");
}

const BODYWEIGHT_RE =
  /pompk|push.?up|podciag|pull.?up|chin.?up|plank|deska|dip|australij|burpee|brzuch|crunch|unoszenie nog|mountain|wyskok|skakank|przysiad bez|wykrok bez/;
const LOADED_RE =
  /sztang|barbell|hantl|dumbbell|\bdb\b|kettle|kula|maszyn|machine|wyciag|cable|pulley|smith|suwnic|leg.?press|hack.?squat|pec.?deck|lat.?pulldown|sciagani|martwy ciag|deadlift|hip.?thrust|goblet/;

export function exerciseUsesExternalLoad(
  ex: Pick<
    WorkoutExerciseState,
    "name" | "sets" | "lastSessionSets" | "suggestedWeights"
  >,
): boolean {
  const positive = (w: number | null | undefined) =>
    w != null && Number.isFinite(w) && w > 0;
  if (ex.sets.some((s) => positive(s.weight))) return true;
  if ((ex.lastSessionSets ?? []).some((s) => positive(s?.weight))) return true;
  if ((ex.suggestedWeights ?? []).some((w) => positive(w))) return true;
  const n = norm(ex.name);
  if (!n) return false;
  if (BODYWEIGHT_RE.test(n)) return false;
  return LOADED_RE.test(n);
}
