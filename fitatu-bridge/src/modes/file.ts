import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizeDiaryResponse } from "../normalize-diary.js";

export async function fileDiary(date: string) {
  const dir = process.env.FITATU_EXPORT_DIR?.trim();
  if (!dir) {
    throw new Error("Brak FITATU_EXPORT_DIR — katalog z plikami diary-YYYY-MM-DD.json.");
  }
  const path = join(dir, `diary-${date}.json`);
  const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
  return normalizeDiaryResponse(raw, date);
}
