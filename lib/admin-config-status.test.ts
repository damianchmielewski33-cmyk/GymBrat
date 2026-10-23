import { describe, expect, it } from "vitest";
import {
  formatHostingFunctionCount,
  getConfigStatus,
  listTrackedEnvNames,
  summarizeConfig,
} from "@/lib/admin-config-status";

const NOT_BLOCKED = { registrationBlocked: false, emailRegistrationMode: "smtp" } as const;

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
    const empty = summarizeConfig(getConfigStatus({}), NOT_BLOCKED);
    expect(empty.requiredIssues).toBeGreaterThan(0);
    expect(empty.readiness).toBe(0);

    const allEnv: Record<string, string> = {};
    for (const item of getConfigStatus({})) {
      for (const v of item.vars) allEnv[v.name] = "1";
    }
    const full = summarizeConfig(getConfigStatus(allEnv), NOT_BLOCKED);
    expect(full.requiredIssues).toBe(0);
    expect(full.recommendedIssues).toBe(0);
    expect(full.hostingIssues).toBe(0);
    expect(full.readiness).toBe(100);
  });

  it("liczy hostingIssues jako wymagane + zalecane (nie opcjonalne)", () => {
    const items = getConfigStatus({});
    const summary = summarizeConfig(items, NOT_BLOCKED);
    expect(summary.hostingIssues).toBe(summary.requiredIssues + summary.recommendedIssues);
    expect(summary.hostingIssues).toBeGreaterThan(0);
    const optionalMissing = items.filter((i) => i.level === "optional" && i.status !== "ok");
    expect(optionalMissing.length).toBeGreaterThan(0);
    expect(summary.hostingIssues).toBeLessThan(items.filter((i) => i.status !== "ok").length);
  });

  it("śledzi zmienne funkcji, które bez hostingu nie działają", () => {
    const names = listTrackedEnvNames();
    for (const required of [
      "CRON_SECRET",
      "VAPID_PUBLIC_KEY",
      "VAPID_PRIVATE_KEY",
      "SMTP_HOST",
      "HOTPAY_SEKRET",
      "POLLINATIONS_API_KEY",
      "JAVA_API_BASE_URL",
    ]) {
      expect(names).toContain(required);
    }
  });

  it("odmienia liczbę funkcji do konfiguracji", () => {
    expect(formatHostingFunctionCount(1)).toBe("1 funkcję");
    expect(formatHostingFunctionCount(2)).toBe("2 funkcje");
    expect(formatHostingFunctionCount(5)).toBe("5 funkcji");
  });

  it("każda brakująca zalecana integracja ma instrukcję hostingu", () => {
    const items = getConfigStatus({});
    for (const item of items.filter((i) => i.level !== "optional")) {
      expect(item.hostingHint.length).toBeGreaterThan(20);
    }
  });

  it("przekazuje registrationBlocked i emailRegistrationMode do podsumowania", () => {
    const items = getConfigStatus({});
    const blocked = summarizeConfig(items, {
      registrationBlocked: true,
      emailRegistrationMode: "disabled",
    });
    expect(blocked.registrationBlocked).toBe(true);
    expect(blocked.emailRegistrationMode).toBe("disabled");
    expect(summarizeConfig(items, NOT_BLOCKED).registrationBlocked).toBe(false);
    expect(
      summarizeConfig(items, { registrationBlocked: false, emailRegistrationMode: "test" })
        .emailRegistrationMode,
    ).toBe("test");
  });

  it("ADMIN_EMAILS nie jest opcjonalne: brak daje stan partial dostępu do panelu", () => {
    const access = getConfigStatus({ ADMIN_PIN: "1234" }).find((i) => i.id === "admin-access");
    expect(access?.status).toBe("partial");
    expect(access?.missing).toEqual(["ADMIN_EMAILS"]);
    const ok = getConfigStatus({ ADMIN_PIN: "1234", ADMIN_EMAILS: "a@b.pl" }).find(
      (i) => i.id === "admin-access",
    );
    expect(ok?.status).toBe("ok");
  });
});
