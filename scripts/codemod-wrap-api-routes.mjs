/**
 * Jednorazowy/idempotentny codemod: opakowuje eksporty metod HTTP w `app/api/**\/route.ts`
 * funkcją `withApiErrors` (lib/errors/api.ts). Uruchom: `node scripts/codemod-wrap-api-routes.mjs`.
 * Pomija trasy już opakowane oraz `auth/[...nextauth]` (handlers Auth.js).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd(), "app", "api");
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const IMPORT_LINE = 'import { withApiErrors } from "@/lib/errors/api";';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name === "route.ts") out.push(full);
  }
  return out;
}

let changed = 0;
for (const file of walk(ROOT)) {
  const rel = relative(process.cwd(), file);
  if (rel.includes("[...nextauth]")) continue;

  let src = readFileSync(file, "utf8");
  if (src.includes("withApiErrors")) continue;

  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const found = [];
  for (const m of METHODS) {
    const re = new RegExp(`^export async function ${m}\\b`, "m");
    if (re.test(src)) {
      if (src.includes(`handle${m}`)) {
        console.error(`SKIP ${rel}: nazwa handle${m} już istnieje`);
        found.length = 0;
        break;
      }
      src = src.replace(re, `async function handle${m}`);
      found.push(m);
    }
  }
  if (found.length === 0) continue;

  const firstImport = src.search(/^import /m);
  if (firstImport === -1) {
    console.error(`SKIP ${rel}: brak importów`);
    continue;
  }
  src = `${src.slice(0, firstImport)}${IMPORT_LINE}${eol}${src.slice(firstImport)}`;

  src = src.replace(/\s*$/, eol);
  src += eol + found.map((m) => `export const ${m} = withApiErrors(handle${m});`).join(eol) + eol;

  writeFileSync(file, src);
  changed += 1;
  console.log(`OK   ${rel} (${found.join(", ")})`);
}
console.log(`Zmieniono plików: ${changed}`);
