import "server-only";

import fs from "node:fs";
import path from "node:path";

/** Pakiet startowy z `data/meal-catalog-starter.json` — tylko do importu w panelu. */
export function readMealCatalogStarterPayload(): unknown {
  const filePath = path.join(process.cwd(), "data", "meal-catalog-starter.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(
      "Brak pliku data/meal-catalog-starter.json — uruchom npm run meals:generate.",
    );
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}
