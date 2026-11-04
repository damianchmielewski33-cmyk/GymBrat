import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Z34: żadna trasa admina nie jest dostępna bez uprawnień. Test (1) enumeruje pliki `app/api/admin/**`
 * i `app/admin/**` z dysku, więc nowa trasa bez bramki wywali test, oraz (2) wywołuje każdy handler
 * jako anonim (401) i jako zwykły użytkownik (403).
 */
const auth = vi.fn();
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/csrf", () => ({ assertCsrf: (): NextResponse | null => null }));
vi.mock("@/lib/rate-limit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rate-limit")>()),
  checkRateLimitAsync: async () => ({ ok: true, retryAfterSec: 0 }),
}));

const ROOT = path.resolve(__dirname, "..");

function walk(dir: string, name: RegExp, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, name, out);
    else if (name.test(entry)) out.push(full);
  }
  return out;
}

const routeFiles = walk(path.join(ROOT, "app/api/admin"), /^route\.ts$/).sort();
const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join("/");

/** Trasy, które z założenia nie są bramkowane `requireAdminApi` — każda z uzasadnieniem. */
const NOT_GATED_BY_REQUIRE_ADMIN: Record<string, string> = {
  "app/api/admin/status/route.ts": "zwraca tylko { eligible, unlocked } (dla anonima false) — używane przez UI do pokazania linku",
  "app/api/admin/bootstrap/route.ts": "pierwszy admin: wymaga sesji (401) i tajnego ADMIN_BOOTSTRAP_TOKEN",
};

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

describe("trasy admina — bramka dostępu (Z34)", () => {
  it("enumeruje trasy admina (test nie jest pusty)", () => {
    expect(routeFiles.length).toBeGreaterThan(15);
  });

  it.each(routeFiles.map((f) => [rel(f), f]))("%s używa requireAdminApi albo jest na liście wyjątków", (name, file) => {
    const src = readFileSync(file as string, "utf8");
    if (NOT_GATED_BY_REQUIRE_ADMIN[name as string]) return;
    expect(src, `${name} musi wołać requireAdminApi()`).toContain("requireAdminApi(");
  });

  it("strony panelu (app/admin/(panel)) są chronione przez layout z isAdminEligible", () => {
    const layout = readFileSync(path.join(ROOT, "app/admin/(panel)/layout.tsx"), "utf8");
    expect(layout).toContain("isAdminEligible");
    expect(layout).toContain("isAdmin2faSatisfied");
    const stray = walk(path.join(ROOT, "app/admin"), /^page\.tsx$/)
      .map(rel)
      .filter((f) => !f.startsWith("app/admin/(panel)/"));
    // Strony poza layoutem panelu muszą same sprawdzać rolę.
    for (const f of stray) {
      expect(readFileSync(path.join(ROOT, f), "utf8"), `${f} musi sprawdzać isAdminEligible`).toContain("isAdminEligible");
    }
  });
});

describe("trasy admina — anonim 401, zwykły użytkownik 403 (Z34)", () => {
  beforeEach(() => auth.mockReset());

  const loaders = import.meta.glob("/app/api/admin/**/route.ts");

  it.each(Object.keys(loaders).sort().filter((k) => !NOT_GATED_BY_REQUIRE_ADMIN[k.slice(1)]))("%s", async (key) => {
    const mod = (await loaders[key]!()) as Record<string, unknown>;
    const handlers = METHODS.filter((m) => typeof mod[m] === "function");
    expect(handlers.length).toBeGreaterThan(0);
    for (const method of handlers) {
      const call = () =>
        (mod[method] as (req: Request, ctx: unknown) => Promise<Response>)(
          new Request("http://localhost/api/admin/x", {
            method,
            headers: { "content-type": "application/json" },
            body: method === "GET" ? undefined : "{}",
          }),
          { params: Promise.resolve({ id: "x" }) },
        );

      auth.mockResolvedValue(null);
      expect((await call()).status, `${method} ${key} anonim`).toBe(401);

      auth.mockResolvedValue({ user: { id: "u1", role: "zawodnik", email: "u@x.pl" } });
      expect((await call()).status, `${method} ${key} zwykły użytkownik`).toBe(403);
    }
  });
});
