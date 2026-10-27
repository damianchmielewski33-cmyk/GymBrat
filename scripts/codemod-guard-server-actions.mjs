/**
 * Codemod: dodaje `await guardAction("plik.nazwa")` jako pierwszą instrukcję każdej eksportowanej
 * akcji serwerowej w `actions/*.ts` (limity żądań — lib/action-guard.ts). Idempotentny.
 * Pomija czyste „loadery” (get* / fetch* / load* / list*) — odczyty bez skutków ubocznych.
 * Uruchom: `node scripts/codemod-guard-server-actions.mjs`.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "actions");
const IMPORT_LINE = 'import { guardAction } from "@/lib/action-guard";';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Ostrzejsze limity dla akcji kosztownych lub podatnych na nadużycia. */
const STRICT = {
  aiAnalyzePhoto: [12, MINUTE],
  generateMealSuggestionsAction: [20, MINUTE],
  activeWorkoutCoachAction: [40, MINUTE],
  changePassword: [8, 15 * MINUTE],
  changePasswordFormAction: [8, 15 * MINUTE],
  changePasswordFormActionVoid: [8, 15 * MINUTE],
  inviteByEmailAction: [10, HOUR],
  requestFriendshipByEmailAction: [20, HOUR],
  searchUsersAction: [120, MINUTE],
  searchFoodProductsAction: [120, MINUTE],
  lookupFoodByBarcodeAction: [60, MINUTE],
  resolveTechniqueUrlsForNames: [60, MINUTE],
  loginUser: [20, 10 * MINUTE],
  sendRegisterCode: [10, HOUR],
  registerUser: [20, HOUR],
  joinTeamByCodeAction: [20, 10 * MINUTE],
};

const LOADER = /^(get|fetch|load|list)[A-Z]/;

/** Znajduje `{` otwierające ciało funkcji, pomijając parametry i typ zwracany. */
function findBodyStart(src, from) {
  let i = src.indexOf("(", from);
  if (i === -1) return -1;
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      for (i++; i < src.length && src[i] !== q; i++) if (src[i] === "\\") i++;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  // Typ zwracany: pierwsze `{` poza <>, () i [].
  let angle = 0;
  let paren = 0;
  let bracket = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "=" && src[i + 1] === ">") {
      i++;
      continue;
    }
    if (c === "<") angle++;
    else if (c === ">") angle--;
    else if (c === "(") paren++;
    else if (c === ")") paren--;
    else if (c === "[") bracket++;
    else if (c === "]") bracket--;
    else if (c === "{" && angle <= 0 && paren === 0 && bracket === 0) return i;
  }
  return -1;
}

let changedFiles = 0;
let guarded = 0;

for (const name of readdirSync(DIR)) {
  if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
  const file = join(DIR, name);
  let src = readFileSync(file, "utf8");
  if (!/^\s*["']use server["']/.test(src)) continue;
  if (src.includes("guardAction(")) continue;

  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const base = name.replace(/\.ts$/, "");
  const re = /^export async function (\w+)/gm;
  const inserts = [];
  let m;
  while ((m = re.exec(src))) {
    const fn = m[1];
    if (LOADER.test(fn)) continue;
    const body = findBodyStart(src, m.index + m[0].length);
    if (body === -1) {
      console.error(`SKIP ${name}:${fn} — nie znaleziono ciała funkcji`);
      continue;
    }
    const strict = STRICT[fn];
    const args = strict ? `, { limit: ${strict[0]}, windowMs: ${strict[1]} }` : "";
    inserts.push({ at: body + 1, text: `${eol}  await guardAction("${base}.${fn}"${args});` });
  }
  if (inserts.length === 0) continue;

  for (const ins of inserts.sort((a, b) => b.at - a.at)) {
    src = src.slice(0, ins.at) + ins.text + src.slice(ins.at);
    guarded++;
  }

  const directive = src.match(/^\s*["']use server["'];?[^\n]*\n/);
  const cut = directive ? directive[0].length : 0;
  src = `${src.slice(0, cut)}${eol}${IMPORT_LINE}${src.slice(cut)}`;

  writeFileSync(file, src);
  changedFiles++;
  console.log(`OK ${name}: ${inserts.length}`);
}
console.log(`Pliki: ${changedFiles}, zabezpieczone akcje: ${guarded}`);
