/**
 * Jedno źródło prawdy dla wdrożeń GymBrat.
 * Opisy zmian i provenance produkcyjny pochodzą wyłącznie z tego repozytorium —
 * nigdy z AWP ani innego projektu.
 */

export const GYMBRAT_GITHUB_OWNER = "damianchmielewski33-cmyk";
export const GYMBRAT_GITHUB_REPO = "GymBrat";
export const GYMBRAT_GITHUB_SLUG = `${GYMBRAT_GITHUB_OWNER}/${GYMBRAT_GITHUB_REPO}`;
export const GYMBRAT_GITHUB_URL = `https://github.com/${GYMBRAT_GITHUB_SLUG}`;

export type DeployProvenance = {
  app: "gymbrat";
  repo: string;
  slug: string;
  sourceTrusted: boolean;
  sha: string | null;
  shortSha: string | null;
  ref: string | null;
  message: string | null;
  environment: string;
  commitUrl: string | null;
};

function firstEnv(env: NodeJS.Dict<string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return null;
}

function normalizeRepoName(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\.git$/i, "");
  const slugMatch = trimmed.match(/github\.com[:/]+([^/]+)\/([^/#?]+)/i);
  if (slugMatch) return `${slugMatch[1]}/${slugMatch[2]}`;
  if (trimmed.includes("/")) return trimmed.replace(/^\/+/, "");
  return trimmed;
}

export function isGymBratRepositorySlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return slug.replace(/\.git$/i, "").toLowerCase() === GYMBRAT_GITHUB_SLUG.toLowerCase();
}

export function resolveReportedSlug(env: NodeJS.Dict<string> = process.env): string | null {
  const full = firstEnv(env, ["GITHUB_REPOSITORY", "GYMBRAT_GIT_SLUG"]);
  if (full && full.includes("/")) return normalizeRepoName(full);

  const owner = firstEnv(env, ["VERCEL_GIT_REPO_OWNER"]);
  const name = firstEnv(env, ["VERCEL_GIT_REPO_SLUG"]);
  if (owner && name) return `${owner}/${name}`;

  const remote = firstEnv(env, ["GYMBRAT_GIT_REMOTE"]);
  return normalizeRepoName(remote);
}

export function readDeployProvenance(
  env: NodeJS.Dict<string> = process.env,
): DeployProvenance {
  const reported = resolveReportedSlug(env);
  const sourceTrusted = reported ? isGymBratRepositorySlug(reported) : true;
  const sha = firstEnv(env, [
    "VERCEL_GIT_COMMIT_SHA",
    "GITHUB_SHA",
    "NEXT_PUBLIC_SENTRY_RELEASE",
  ]);
  const shortSha = sha ? sha.replace(/^gymbrat@/i, "").slice(0, 7) : null;
  const ref = firstEnv(env, [
    "VERCEL_GIT_COMMIT_REF",
    "GITHUB_REF_NAME",
    "VERCEL_GIT_COMMIT_REF",
  ]);
  const message = firstEnv(env, ["VERCEL_GIT_COMMIT_MESSAGE"]);
  const environment =
    firstEnv(env, ["VERCEL_ENV", "SENTRY_ENVIRONMENT"]) ??
    (env.NODE_ENV === "production" ? "production" : "development");

  return {
    app: "gymbrat",
    repo: GYMBRAT_GITHUB_URL,
    slug: GYMBRAT_GITHUB_SLUG,
    sourceTrusted,
    sha,
    shortSha,
    ref,
    message,
    environment,
    commitUrl: sha ? `${GYMBRAT_GITHUB_URL}/commit/${sha}` : GYMBRAT_GITHUB_URL,
  };
}
