import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError, isNextControlFlowError, toAppError } from "@/lib/errors/app-error";
import {
  ERROR_CATALOG,
  ERROR_CODES,
  classifyForbidden,
  codeForStatus,
  codeFromResponse,
  formatErrorLine,
  isSafeServerMessage,
  resolveUserMessage,
} from "@/lib/errors/catalog";

describe("katalog błędów", () => {
  it("każdy kod ma niepusty komunikat PL i opis do logów", () => {
    for (const code of ERROR_CODES) {
      const entry = ERROR_CATALOG[code];
      expect(entry.message.length, code).toBeGreaterThan(10);
      expect(entry.log.length, code).toBeGreaterThan(5);
    }
  });

  it("komunikaty dla użytkownika nie zawierają żargonu technicznego", () => {
    for (const code of ERROR_CODES) {
      expect(ERROR_CATALOG[code].message, code).not.toMatch(/HTTP\s*\d|TypeError|stack|SQL|JSON/);
    }
  });

  it("mapuje statusy HTTP na kody", () => {
    expect(codeForStatus(400)).toBe("BAD_REQUEST");
    expect(codeForStatus(401)).toBe("UNAUTHORIZED");
    expect(codeForStatus(404)).toBe("NOT_FOUND");
    expect(codeForStatus(429)).toBe("RATE_LIMITED");
    expect(codeForStatus(500)).toBe("INTERNAL");
    expect(codeForStatus(503)).toBe("SERVICE_UNAVAILABLE");
    expect(codeForStatus(418)).toBe("BAD_REQUEST");
    expect(codeForStatus(599)).toBe("INTERNAL");
  });

  it("rozróżnia powody 403", () => {
    expect(classifyForbidden("Sesja bezpieczeństwa wygasła")).toBe("CSRF_FAILED");
    expect(classifyForbidden("Żądanie pochodzi z niedozwolonej witryny")).toBe("ORIGIN_BLOCKED");
    expect(classifyForbidden("Brak uprawnień")).toBe("FORBIDDEN");
    expect(codeFromResponse(403, "CSRF")).toBe("CSRF_FAILED");
  });

  it("jawny kod z API ma pierwszeństwo, 400 + JSON → INVALID_JSON", () => {
    expect(codeFromResponse(500, "x", "SERVICE_UNAVAILABLE")).toBe("SERVICE_UNAVAILABLE");
    expect(codeFromResponse(400, "Nieprawidłowy JSON")).toBe("INVALID_JSON");
    expect(codeFromResponse(400, "Wybierz pakiet.")).toBe("BAD_REQUEST");
  });

  it("pokazuje komunikat serwera tylko gdy jest bezpieczny", () => {
    expect(isSafeServerMessage("Wybierz pakiet.")).toBe(true);
    expect(isSafeServerMessage("Unauthorized")).toBe(false);
    expect(isSafeServerMessage("TypeError: x is undefined")).toBe(false);
    expect(isSafeServerMessage("x".repeat(500))).toBe(false);
    expect(resolveUserMessage("NOT_FOUND", "Not found")).toBe(ERROR_CATALOG.NOT_FOUND.message);
    expect(resolveUserMessage("BAD_REQUEST", "Wybierz pakiet.")).toBe("Wybierz pakiet.");
  });

  it("formatuje jedną linię logu z kodem, statusem i ref", () => {
    const line = formatErrorLine({
      side: "serwer",
      code: "INTERNAL",
      status: 500,
      message: "boom",
      method: "POST",
      path: "/api/x",
      requestId: "abc123",
    });
    expect(line).toBe("[GymBrat][serwer][500][INTERNAL] POST /api/x — boom (ref abc123)");
    expect(
      formatErrorLine({ side: "przeglądarka", code: "NETWORK", status: 0, message: "m" }),
    ).toContain("[CLIENT][NETWORK]");
  });
});

describe("toAppError", () => {
  it("zachowuje AppError", () => {
    const err = new AppError("NOT_FOUND");
    expect(toAppError(err)).toBe(err);
    expect(err.status).toBe(404);
  });

  it("ZodError → 400 VALIDATION_FAILED z polami", () => {
    const parsed = z.object({ sku: z.string().min(1) }).safeParse({ sku: "" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const err = toAppError(parsed.error);
    expect(err.code).toBe("VALIDATION_FAILED");
    expect(err.status).toBe(400);
    expect(err.fieldErrors?.sku?.length).toBeGreaterThan(0);
  });

  it("zepsuty JSON → 400 INVALID_JSON", () => {
    let thrown: unknown;
    try {
      JSON.parse("{nope");
    } catch (e) {
      thrown = e;
    }
    expect(toAppError(thrown).code).toBe("INVALID_JSON");
  });

  it("błędy połączenia z bazą → 503, timeout → 504, reszta → 500", () => {
    expect(toAppError(new Error("SQLITE_BUSY: database is locked")).status).toBe(503);
    expect(toAppError(new Error("fetch failed")).status).toBe(503);
    const timeout = new Error("signal timed out");
    timeout.name = "TimeoutError";
    expect(toAppError(timeout).status).toBe(504);
    expect(toAppError(new Error("coś innego")).status).toBe(500);
    expect(toAppError("string").status).toBe(500);
  });

  it("uznaje status z błędu biblioteki", () => {
    const e = Object.assign(new Error("nope"), { status: 429 });
    expect(toAppError(e).code).toBe("RATE_LIMITED");
  });

  it("rozpoznaje sterowanie przepływem Next.js", () => {
    expect(isNextControlFlowError(Object.assign(new Error("x"), { digest: "NEXT_REDIRECT;a" }))).toBe(true);
    expect(isNextControlFlowError(Object.assign(new Error("x"), { digest: "DYNAMIC_SERVER_USAGE" }))).toBe(true);
    expect(isNextControlFlowError(new Error("zwykły"))).toBe(false);
  });
});
