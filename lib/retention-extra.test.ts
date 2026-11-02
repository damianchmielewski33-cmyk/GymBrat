import type { Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { createMemoryDb, countRows } from "@/db/test-memory-db";
import { getExtraRetentionPolicy, runBugReportRetention, runInactiveRetention } from "@/lib/retention-extra";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 2);
const ago = (days: number) => new Date(NOW - days * DAY);

describe("getExtraRetentionPolicy", () => {
  it("domyślnie: konta wyłączone, 24/12 mies., ostrzeżenie 30 dni, zgłoszenia 365/90 dni", () => {
    expect(getExtraRetentionPolicy({})).toEqual({
      inactiveAccountsEnabled: false,
      inactiveAccountMonths: 24,
      inactivePhotosMonths: 12,
      warnDays: 30,
      bugReportDays: 365,
      bugScreenshotDays: 90,
    });
  });
  it("flaga włącza tylko „1”, a ostrzeżenie nie może być krótsze niż 7 dni", () => {
    expect(getExtraRetentionPolicy({ RETENTION_INACTIVE_ACCOUNTS_ENABLED: "true" }).inactiveAccountsEnabled).toBe(false);
    expect(getExtraRetentionPolicy({ RETENTION_INACTIVE_ACCOUNTS_ENABLED: "1" }).inactiveAccountsEnabled).toBe(true);
    expect(getExtraRetentionPolicy({ RETENTION_INACTIVE_WARN_DAYS: "0" }).warnDays).toBe(7);
  });
});

describe("retencja zgłoszeń błędów i nieaktywnych kont (Z28)", () => {
  let client: Client;
  let db: Database;
  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
  });
  afterAll(() => client.close());
  beforeEach(async () => {
    for (const t of ["bug_report_photos", "bug_reports", "body_report_photos", "body_reports", "user_settings", "users"]) {
      await client.execute(`DELETE FROM ${t}`);
    }
  });

  const policyOn = getExtraRetentionPolicy({ RETENTION_INACTIVE_ACCOUNTS_ENABLED: "1" });
  const policyOff = getExtraRetentionPolicy({});

  it("zgłoszenia: zrzuty po 90 dniach, treść po 365 dniach od rozwiązania; otwarte i świeże zostają", async () => {
    await db.insert(schema.users).values({ id: "u1", email: "u1@example.com", passwordHash: "x" });
    const base = { userId: "u1", description: "d", priority: "low" } as const;
    await db.insert(schema.bugReports).values([
      { ...base, id: "fresh", status: "fixed", resolvedAt: ago(10) },
      { ...base, id: "shots", status: "fixed", resolvedAt: ago(100) },
      { ...base, id: "old", status: "fixed", resolvedAt: ago(400) },
      { ...base, id: "open", status: "analysis", createdAt: ago(900) },
    ]);
    await db.insert(schema.bugReportPhotos).values(
      ["fresh", "shots", "old", "open"].map((id) => ({ bugReportId: id, dataUrl: "d" })),
    );
    const res = await runBugReportRetention(db, NOW, policyOff);
    expect(res).toEqual({ screenshotsDeleted: 2, reportsDeleted: 1 });
    expect(await countRows(client, "bug_reports")).toBe(3);
    expect(await countRows(client, "bug_report_photos", "bug_report_id IN ('fresh','open')")).toBe(2);
    expect(await countRows(client, "bug_report_photos", "bug_report_id IN ('shots','old')")).toBe(0);
  });

  it("flaga wyłączona: nieaktywne konta nietknięte, ostrzeżenia nie wychodzą", async () => {
    await db.insert(schema.users).values({ id: "old", email: "o@example.com", passwordHash: "x", createdAt: ago(1500) });
    const sendWarning = vi.fn(async () => true);
    const res = await runInactiveRetention(db, NOW, policyOff, { sendWarning });
    expect(res).toEqual({ photosWarned: 0, photosPurged: 0, accountsWarned: 0, accountsDeleted: 0 });
    expect(sendWarning).not.toHaveBeenCalled();
    expect(await countRows(client, "users")).toBe(1);
  });

  it("konto: najpierw ostrzeżenie, kasowanie dopiero po 30 dniach; aktywni, admin i płacący chronieni", async () => {
    await db.insert(schema.users).values([
      { id: "old", email: "old@example.com", passwordHash: "x", createdAt: ago(1500) },
      { id: "active", email: "a@example.com", passwordHash: "x", createdAt: ago(1500), lastActiveAt: ago(5) },
      { id: "admin", email: "ad@example.com", passwordHash: "x", createdAt: ago(1500), appRole: "admin" },
      { id: "paying", email: "p@example.com", passwordHash: "x", createdAt: ago(1500), packageEndsAt: new Date(NOW + DAY) },
    ]);
    const sendWarning = vi.fn(async () => true);

    const first = await runInactiveRetention(db, NOW, policyOn, { sendWarning });
    expect(first.accountsWarned).toBe(1);
    expect(first.accountsDeleted).toBe(0);
    expect(sendWarning).toHaveBeenCalledWith({ to: "old@example.com", kind: "account", daysToDelete: 30 });
    expect(await countRows(client, "users")).toBe(4);

    // 29 dni po ostrzeżeniu — jeszcze nic.
    expect((await runInactiveRetention(db, NOW + 29 * DAY, policyOn, { sendWarning })).accountsDeleted).toBe(0);
    // 31 dni po ostrzeżeniu — usunięte tylko nieaktywne konto.
    const later = await runInactiveRetention(db, NOW + 31 * DAY, policyOn, { sendWarning });
    expect(later.accountsDeleted).toBe(1);
    const left = (await client.execute(`SELECT id FROM users ORDER BY id`)).rows.map((r) => String(r.id));
    expect(left).toEqual(["active", "admin", "paying"]);
  });

  it("brak wysłanego ostrzeżenia (np. brak SMTP) = brak kasowania", async () => {
    await db.insert(schema.users).values({ id: "old", email: "old@example.com", passwordHash: "x", createdAt: ago(1500) });
    const sendWarning = vi.fn(async () => false);
    await runInactiveRetention(db, NOW, policyOn, { sendWarning });
    const res = await runInactiveRetention(db, NOW + 60 * DAY, policyOn, { sendWarning });
    expect(res.accountsDeleted).toBe(0);
    expect(await countRows(client, "users")).toBe(1);
  });

  it("powrót użytkownika (wyczyszczone ostrzeżenie + świeża aktywność) wstrzymuje usunięcie", async () => {
    await db.insert(schema.users).values({ id: "old", email: "old@example.com", passwordHash: "x", createdAt: ago(1500) });
    const sendWarning = vi.fn(async () => true);
    await runInactiveRetention(db, NOW, policyOn, { sendWarning });
    await client.execute(`UPDATE users SET last_active_at = ${NOW + DAY}, inactivity_warned_at = NULL, photos_warned_at = NULL`);
    const res = await runInactiveRetention(db, NOW + 40 * DAY, policyOn, { sendWarning });
    expect(res.accountsDeleted).toBe(0);
    expect(await countRows(client, "users")).toBe(1);
  });

  it("zdjęcia sylwetki: po 12 mies. i ostrzeżeniu znikają same zdjęcia, konto i dane zostają", async () => {
    await db.insert(schema.users).values({ id: "u", email: "u@example.com", passwordHash: "x", createdAt: ago(500) });
    await db.insert(schema.bodyReports).values({ id: "r1", userId: "u" } as never);
    await db.insert(schema.bodyReportPhotos).values({ reportId: "r1", dataUrl: "foto" });
    await db.insert(schema.userSettings).values({ userId: "u", startPhotoDataUrl: "start" } as never);
    const sendWarning = vi.fn(async () => true);

    await runInactiveRetention(db, NOW, policyOn, { sendWarning });
    expect(sendWarning).toHaveBeenCalledWith(expect.objectContaining({ kind: "photos" }));
    expect(await countRows(client, "body_report_photos")).toBe(1);

    const res = await runInactiveRetention(db, NOW + 31 * DAY, policyOn, { sendWarning });
    expect(res.photosPurged).toBe(1);
    expect(await countRows(client, "body_report_photos")).toBe(0);
    expect(await countRows(client, "body_reports")).toBe(1);
    expect(await countRows(client, "users")).toBe(1);
    expect(await countRows(client, "user_settings", "start_photo_data_url IS NULL")).toBe(1);
  });
});
