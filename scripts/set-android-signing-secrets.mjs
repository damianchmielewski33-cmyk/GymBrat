#!/usr/bin/env node
/**
 * Ustawia sekrety podpisu APK z katalogu artifactu „Bootstrap Android signing”.
 *
 * Użycie:
 *   node scripts/set-android-signing-secrets.mjs ./gymbrat-android-release-keystore
 *
 * Wymaga: gh auth login (zakres secrets repo).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const dir = resolve(process.argv[2] || "");
if (!dir || !existsSync(dir)) {
  console.error(
    "Podaj katalog z artifactu Bootstrap Android signing.\n" +
      "Przykład: node scripts/set-android-signing-secrets.mjs ./gymbrat-android-release-keystore"
  );
  process.exit(1);
}

const b64Path = join(dir, "keystore-base64.txt");
const secretsPath = join(dir, "github-secrets.txt");
if (!existsSync(b64Path) || !existsSync(secretsPath)) {
  console.error("Brak keystore-base64.txt lub github-secrets.txt w", dir);
  process.exit(1);
}

const b64 = readFileSync(b64Path, "utf8").trim();
const secretsTxt = readFileSync(secretsPath, "utf8");
const map = {};
for (const line of secretsTxt.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 1) continue;
  map[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const required = [
  "ANDROID_RELEASE_KEY_ALIAS",
  "ANDROID_RELEASE_KEYSTORE_PASSWORD",
  "ANDROID_RELEASE_KEY_PASSWORD",
];
for (const k of required) {
  if (!map[k]) {
    console.error("Brak", k, "w github-secrets.txt");
    process.exit(1);
  }
}

function setSecret(name, value) {
  const r = spawnSync("gh", ["secret", "set", name, "--body", value], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || `gh secret set ${name} failed`);
    process.exit(r.status || 1);
  }
  console.log("OK", name);
}

setSecret("ANDROID_RELEASE_KEYSTORE_BASE64", b64);
setSecret("ANDROID_RELEASE_KEY_ALIAS", map.ANDROID_RELEASE_KEY_ALIAS);
setSecret(
  "ANDROID_RELEASE_KEYSTORE_PASSWORD",
  map.ANDROID_RELEASE_KEYSTORE_PASSWORD
);
setSecret("ANDROID_RELEASE_KEY_PASSWORD", map.ANDROID_RELEASE_KEY_PASSWORD);

console.log(
  "\nSekrety ustawione. Odpal „Build Android APK”, potem na telefonach z\n" +
    "starym (debug) APK: jednorazowo odinstaluj i zainstaluj nowy gymbrat.apk.\n" +
    "Kolejne aktualizacje pójdą bez odinstalowywania."
);
