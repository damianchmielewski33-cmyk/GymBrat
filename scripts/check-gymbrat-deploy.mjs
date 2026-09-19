#!/usr/bin/env node
/**
 * Deploy Guardian (CI): zmiany GymBrat muszą być jasno opisane
 * i iść z repozytorium damianchmielewski33-cmyk/GymBrat.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_SLUG = "damianchmielewski33-cmyk/GymBrat";
const CHANGELOG_FILE = "components/changelog/changelog-data.ts";
const USER_FACING =
  /^(app\/|components\/|public\/|actions\/|proxy\.ts|next\.config\.ts)/;
const SKIP_ACTORS = new Set(["dependabot[bot]", "dependabot"]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    ...options,
  }).trim();
}

function resolveSlug() {
  const fromEnv = process.env.GITHUB_REPOSITORY?.trim();
  if (fromEnv) return fromEnv;
  try {
    const remote = git(["remote", "get-url", "origin"]);
    const match = remote.match(/github\.com[:/]+([^/]+)\/([^/#?]+)/i);
    if (match) return `${match[1]}/${match[2].replace(/\.git$/i, "")}`;
  } catch {
    /* ignore */
  }
  return "";
}

function changedFiles() {
  const base = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : "origin/master";
  try {
    git(["rev-parse", "--verify", base]);
    return git(["diff", "--name-only", `${base}...HEAD`])
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return git(["diff", "--name-only", "HEAD~1"]).split("\n").filter(Boolean);
  }
}

function changelogMentionsGymBrat() {
  const file = path.join(root, CHANGELOG_FILE);
  if (!existsSync(file)) fail(`Brak ${CHANGELOG_FILE} — changelog musi żyć w GymBrat.`);
  const text = readFileSync(file, "utf8");
  if (!text.includes(EXPECTED_SLUG)) {
    fail(
      `${CHANGELOG_FILE} musi wskazywać źródło ${EXPECTED_SLUG}. Zmiany GymBrat nie mogą iść z AWP ani innego repo.`,
    );
  }
  if (!/sourceRepo:\s*GYMBRAT_GITHUB_SLUG/.test(text)) {
    fail(`${CHANGELOG_FILE}: każdy wpis musi mieć sourceRepo z repozytorium GymBrat.`);
  }
}

const slug = resolveSlug();
if (slug !== EXPECTED_SLUG) {
  fail(
    `Wdrożenie i opisy zmian GymBrat tylko z ${EXPECTED_SLUG}. Wykryto: ${slug || "(brak remote)"}.`,
  );
}

changelogMentionsGymBrat();

const event = process.env.GITHUB_EVENT_NAME ?? "";
const actor = process.env.GITHUB_ACTOR ?? "";
if (event === "pull_request" && !SKIP_ACTORS.has(actor)) {
  const files = changedFiles();
  const touchesUi = files.some((file) => USER_FACING.test(file));
  const updatesChangelog = files.includes(CHANGELOG_FILE);
  if (touchesUi && !updatesChangelog) {
    fail(
      "PR rusza UI/publiczne pliki GymBrat, ale nie aktualizuje changelogu. Opisz zmianę jasno w components/changelog/changelog-data.ts (źródło: to repozytorium).",
    );
  }
}

let summary = `Repozytorium: ${slug}\nŹródło changelogu: ${CHANGELOG_FILE}\n`;
try {
  const log = git(["log", "-8", "--pretty=format:%h %s"]);
  summary += `\nOstatnie commity z repozytorium GymBrat:\n${log}\n`;
} catch {
  /* ignore */
}

console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Deploy Guardian — GymBrat\n\n\`\`\`\n${summary}\n\`\`\`\n`,
  );
}
