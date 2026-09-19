import { describe, expect, it } from "vitest";
import {
  GYMBRAT_GITHUB_SLUG,
  GYMBRAT_GITHUB_URL,
  isGymBratRepositorySlug,
  readDeployProvenance,
  resolveReportedSlug,
} from "@/lib/gymbrat-source";

describe("GymBrat source identity", () => {
  it("akceptuje wyłącznie kanoniczne repozytorium GymBrat", () => {
    expect(isGymBratRepositorySlug(GYMBRAT_GITHUB_SLUG)).toBe(true);
    expect(isGymBratRepositorySlug("damianchmielewski33-cmyk/GymBrat.git")).toBe(
      true,
    );
    expect(isGymBratRepositorySlug("other-org/GymBrat")).toBe(false);
    expect(isGymBratRepositorySlug("damianchmielewski33-cmyk/awp")).toBe(false);
  });

  it("czyta slug z GitHub Actions i Vercel, nie z obcego remote", () => {
    expect(
      resolveReportedSlug({ GITHUB_REPOSITORY: GYMBRAT_GITHUB_SLUG }),
    ).toBe(GYMBRAT_GITHUB_SLUG);
    expect(
      resolveReportedSlug({
        VERCEL_GIT_REPO_OWNER: "damianchmielewski33-cmyk",
        VERCEL_GIT_REPO_SLUG: "GymBrat",
      }),
    ).toBe(GYMBRAT_GITHUB_SLUG);
    expect(
      resolveReportedSlug({
        GYMBRAT_GIT_REMOTE: "https://github.com/other/awp.git",
      }),
    ).toBe("other/awp");
  });

  it("oznacza wdrożenie z innego repozytorium jako niezaufane", () => {
    const provenance = readDeployProvenance({
      GITHUB_REPOSITORY: "other/akademia-wielkich-pilkarzy",
      VERCEL_GIT_COMMIT_SHA: "abc123def456",
      VERCEL_GIT_COMMIT_MESSAGE: "zmiana z AWP",
      VERCEL_ENV: "production",
    });
    expect(provenance.app).toBe("gymbrat");
    expect(provenance.repo).toBe(GYMBRAT_GITHUB_URL);
    expect(provenance.slug).toBe(GYMBRAT_GITHUB_SLUG);
    expect(provenance.sourceTrusted).toBe(false);
    expect(provenance.shortSha).toBe("abc123d");
    expect(provenance.commitUrl).toBe(`${GYMBRAT_GITHUB_URL}/commit/abc123def456`);
  });

  it("uznaje wdrożenie z GymBrat za zaufane", () => {
    const provenance = readDeployProvenance({
      GITHUB_REPOSITORY: GYMBRAT_GITHUB_SLUG,
      VERCEL_GIT_COMMIT_SHA: "06820a0cafe",
      VERCEL_GIT_COMMIT_REF: "master",
      VERCEL_ENV: "production",
    });
    expect(provenance.sourceTrusted).toBe(true);
    expect(provenance.ref).toBe("master");
  });
});
