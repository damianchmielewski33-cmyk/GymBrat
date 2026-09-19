import { NextResponse } from "next/server";
import { CHANGELOG_ENTRIES } from "@/components/changelog/changelog-data";
import { isPlannedChangelogEntry } from "@/lib/deploy-changelog";
import { readDeployProvenance } from "@/lib/gymbrat-source";
import { checkRateLimitAsync, RATE, rateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Publiczny JSON: co jest wdrożone i że pochodzi z repozytorium GymBrat. */
export async function GET(req: Request) {
  const limited = await checkRateLimitAsync(
    rateLimitKey("version", req),
    RATE.version.limit,
    RATE.version.windowMs,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Zbyt wiele zapytań o wersję." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  const provenance = readDeployProvenance();
  const changelog = CHANGELOG_ENTRIES.filter((entry) => !isPlannedChangelogEntry(entry)).map(
    (entry) => ({
      title: entry.title,
      date: entry.date ?? null,
      sourceRepo: entry.sourceRepo,
      sha: entry.sha ?? null,
      bullets: entry.bullets,
    }),
  );

  const res = NextResponse.json({
    ...provenance,
    changelog,
  });
  res.headers.set("Cache-Control", "public, no-store");
  return res;
}
