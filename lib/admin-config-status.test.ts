import { describe, expect, it } from "vitest";
import { getConfigStatus, summarizeConfig } from "@/lib/admin-config-status";

describe("admin-config-status", () => {
  it("oznacza brak wszystkich zmiennych jako missing i wymienia brakujące nazwy", () => {
    const items = getConfigStatus({});
    const auth = items.find((i) => i.id === "auth");
    expect(auth?.status).toBe("missing");
    expect(auth?.missing).toEqual(["AUTH_SECRET"]);
  });

  it("akceptuje alias zmiennej jako ustawioną", () => {
    const items = getConfigStatus({ NEXTAUTH_SECRET: "x" });
    expect(items.find((i) => i.id === "auth")?.status).toBe("ok");
  });

  it("zwraca partial, gdy ustawiona jest tylko część zmiennych", () => {
    const items = getConfigStatus({ SMTP_HOST: "smtp.example.com" });
    const email = items.find((i) => i.id === "email");
    expect(email?.status).toBe("partial");
    expect(email?.missing).toEqual(["SMTP_USER", "SMTP_PASS"]);
  });

  it("ignoruje zmienne optional przy liczeniu statusu", () => {
    const items = getConfigStatus({
      TURSO_DATABASE_URL: "file:./local.db",
    });
    expect(items.find((i) => i.id === "database")?.status).toBe("ok");
  });

  it("traktuje puste i białe znaki jako brak wartości", () => {
    const items = getConfigStatus({ AUTH_SECRET: "   " });
    expect(items.find((i) => i.id === "auth")?.status).toBe("missing");
  });

  it("nie zwraca wartości zmiennych", () => {
    const items = getConfigStatus({ AUTH_SECRET: "super-tajny-sekret" });
    expect(JSON.stringify(items)).not.toContain("super-tajny-sekret");
  });

  it("liczy podsumowanie gotowości", () => {
    const empty = summarizeConfig(getConfigStatus({}));
    expect(empty.requiredIssues).toBeGreaterThan(0);
    expect(empty.readiness).toBe(0);

    const allEnv: Record<string, string> = {};
    for (const item of getConfigStatus({})) {
      for (const v of item.vars) allEnv[v.name] = "1";
    }
    const full = summarizeConfig(getConfigStatus(allEnv));
    expect(full.requiredIssues).toBe(0);
    expect(full.recommendedIssues).toBe(0);
    expect(full.readiness).toBe(100);
  });
});
