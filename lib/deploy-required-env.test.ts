import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  REQUIRED_PRODUCTION_ENV,
  missingProductionEnv,
  parseEnvFile,
} from "../scripts/deploy-required-env.mjs";

const FULL = {
  HOTPAY_SEKRET: "s",
  HOTPAY_NOTIFICATION_PASSWORD: "p",
  SMTP_HOST: "smtp.example.com",
  SMTP_USER: "u",
  SMTP_PASS: "x",
  UPSTASH_REDIS_REST_URL: "https://x.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "t",
  CRON_SECRET: "c",
  ADMIN_EMAILS: "owner@example.com",
};

describe("missingProductionEnv (deploy:check --production)", () => {
  it("komplet konfiguracji przechodzi", () => {
    expect(missingProductionEnv(FULL)).toEqual([]);
  });

  it("pusta konfiguracja blokuje wszystkie pięć obszarów", () => {
    const ids = missingProductionEnv({}).map((p) => p.id);
    expect(ids).toEqual(["payments", "email", "rate-limit", "cron", "admin-access"]);
  });

  it("brak jednej zmiennej wskazuje dokładnie ją", () => {
    const { SMTP_PASS: _omit, ...rest } = FULL;
    void _omit;
    expect(missingProductionEnv(rest)).toEqual([
      { id: "email", label: "Wysyłka e-mail (SMTP)", missing: ["SMTP_PASS"] },
    ]);
  });

  it("puste/same spacje i ADMIN_EMAILS bez adresu e-mail to brak", () => {
    expect(missingProductionEnv({ ...FULL, CRON_SECRET: "   " }).map((p) => p.id)).toEqual(["cron"]);
    expect(missingProductionEnv({ ...FULL, ADMIN_EMAILS: "admin" }).map((p) => p.id)).toEqual([
      "admin-access",
    ]);
  });

  it("nazwy zmiennych zgadzają się z panelem Konfiguracja (admin-config-status)", () => {
    const source = readFileSync(
      path.resolve(__dirname, "admin-config-status.ts"),
      "utf8",
    );
    for (const group of REQUIRED_PRODUCTION_ENV) {
      for (const name of group.names) {
        expect(source, `${name} w admin-config-status.ts`).toContain(`"${name}"`);
      }
    }
  });
});

describe("parseEnvFile", () => {
  it("czyta KEY=VALUE, cudzysłowy, komentarze i export", () => {
    const env = parseEnvFile(
      '# komentarz\nCRON_SECRET="abc"\nexport SMTP_HOST=smtp.x.pl\n\nPUSTE=\nBEZ_ROWNOSCI\n',
    );
    expect(env).toEqual({ CRON_SECRET: "abc", SMTP_HOST: "smtp.x.pl", PUSTE: "" });
  });
});
