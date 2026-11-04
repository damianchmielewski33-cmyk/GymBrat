/**
 * Z39: przenosi zdjęcia raportów sylwetki z `body_report_photos.data_url` do magazynu S3.
 *
 *   PHOTO_STORAGE=s3 OBJECT_STORAGE_*=... node --experimental-strip-types scripts/migrate-photos-to-storage.ts [--dry-run] [--limit=200]
 *
 * Bezpieczeństwo: wiersz jest aktualizowany dopiero po udanym PUT i odczycie kontrolnym (GET == PUT);
 * `data_url` zostaje wyczyszczony ("") dopiero w tym samym UPDATE. Skrypt jest wznawialny
 * (przetwarza tylko wiersze bez `object_key`). Wycofanie: `--rollback` przywraca `data_url` z obiektu
 * i zeruje `object_key` (obiekty zostają, usuwa je osobno właściciel po weryfikacji).
 * Ładunek jest już zaszyfrowany polem (gbenc:v1:) — do S3 trafia ten sam szyfrogram.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@libsql/client";
import { getObjectStorageConfig, getObjectText, putObject } from "../lib/object-storage-core.ts";

function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      const k = t.slice(0, i).trim();
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

async function main() {
  loadEnvFiles();
  const args = process.argv.slice(2);
  const dry = args.includes("--dry-run");
  const rollback = args.includes("--rollback");
  const limit = Number(args.find((a) => a.startsWith("--limit="))?.slice(8) ?? 200);
  if (!getObjectStorageConfig()) {
    throw new Error("Ustaw PHOTO_STORAGE=s3 oraz OBJECT_STORAGE_ENDPOINT/BUCKET/ACCESS_KEY_ID/SECRET_ACCESS_KEY.");
  }
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
    ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
  });
  let done = 0;
  if (rollback) {
    const rs = await client.execute({
      sql: "SELECT id, object_key FROM body_report_photos WHERE object_key IS NOT NULL LIMIT ?",
      args: [limit],
    });
    for (const r of rs.rows) {
      const payload = await getObjectText(String(r.object_key));
      if (!payload) { console.warn(`brak obiektu dla ${r.id}`); continue; }
      if (!dry) {
        await client.execute({
          sql: "UPDATE body_report_photos SET data_url = ?, object_key = NULL WHERE id = ?",
          args: [payload, String(r.id)],
        });
      }
      done++;
    }
    console.log(`${dry ? "[dry-run] " : ""}Przywrócono do bazy: ${done}`);
    return;
  }
  const rs = await client.execute({
    sql: `SELECT p.id, p.report_id, p.data_url, r.user_id FROM body_report_photos p
          JOIN body_reports r ON r.id = p.report_id
          WHERE p.object_key IS NULL AND length(trim(p.data_url)) > 0 LIMIT ?`,
    args: [limit],
  });
  for (const r of rs.rows) {
    const payload = String(r.data_url);
    const key = `body-reports/${r.user_id}/${r.report_id}/${r.id}`;
    if (dry) { done++; continue; }
    await putObject(key, payload, "text/plain");
    const back = await getObjectText(key);
    if (back !== payload) throw new Error(`Weryfikacja obiektu nie powiodła się dla ${r.id}`);
    await client.execute({
      sql: "UPDATE body_report_photos SET object_key = ?, data_url = '' WHERE id = ? AND object_key IS NULL",
      args: [key, String(r.id)],
    });
    done++;
  }
  console.log(`${dry ? "[dry-run] do przeniesienia" : "Przeniesiono"}: ${done}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
