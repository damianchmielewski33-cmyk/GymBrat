import { afterEach, describe, expect, it, vi } from "vitest";
import { getRetentionPolicy } from "@/lib/db-retention";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getRetentionPolicy", () => {
  it("domyślnie: kody 24 h, dziennik audytu 180 dni", () => {
    vi.stubEnv("RETENTION_EMAIL_CODES_HOURS", "");
    vi.stubEnv("RETENTION_ADMIN_AUDIT_DAYS", "");
    const policy = getRetentionPolicy();
    expect(policy.emailCodesHours).toBe(24);
    expect(policy.adminAuditDays).toBe(180);
  });

  it("kody: zmienna może skrócić, ale nie wydłużyć ponad 24 h (LR-20)", () => {
    vi.stubEnv("RETENTION_EMAIL_CODES_HOURS", "6");
    expect(getRetentionPolicy().emailCodesHours).toBe(6);
    vi.stubEnv("RETENTION_EMAIL_CODES_HOURS", "336");
    expect(getRetentionPolicy().emailCodesHours).toBe(24);
  });

  it("dziennik audytu: zmienna może wydłużyć, ale nie skrócić poniżej 180 dni (LR-26)", () => {
    vi.stubEnv("RETENTION_ADMIN_AUDIT_DAYS", "30");
    expect(getRetentionPolicy().adminAuditDays).toBe(180);
    vi.stubEnv("RETENTION_ADMIN_AUDIT_DAYS", "365");
    expect(getRetentionPolicy().adminAuditDays).toBe(365);
  });
});
