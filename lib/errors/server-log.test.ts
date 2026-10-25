import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toAppError } from "@/lib/errors/app-error";
import { logServerError } from "@/lib/errors/server-log";

/**
 * Regresja F-1 (`docs/bezpieczenstwo/005-koniec-treningu-przeplyw.md`): wymusza błąd zapisu
 * z syntetycznym, rozpoznawalnym "tętnem" w SQL params (symulacja `DrizzleQueryError`) i
 * potwierdza, że NI console.error, NI Sentry.captureException go nie zawierają — na całej
 * ścieżce `withApiErrors` → `toAppError` → `logServerError` → `captureToSentry`.
 */
const SECRET_HR = "SYNTH-HR-151-SECRET";

function makeDrizzleQueryError() {
  const query = `insert into "workouts" ("id","user_id","exercises") values (?, ?, ?)`;
  const params = `t-1,,{"kind":"completed_session","cardio":{"avgHr":"${SECRET_HR}"}}`;
  return Object.assign(new Error(`Failed query: ${query}\nparams: ${params}`), {
    query,
    params,
  }) as Error & { query: string; params: unknown };
}

describe("logServerError — F-1 (brak SQL/parametrów w logach i w Sentry)", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  const captureException = vi.fn();

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    captureException.mockClear();
    vi.doMock("@sentry/nextjs", () => ({ captureException }));
    process.env.SENTRY_DSN = "https://example.test/1";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("@sentry/nextjs");
    delete process.env.SENTRY_DSN;
  });

  it("console.error (linia + stack) nie zawiera SQL/parametrów ani wartości tętna", async () => {
    const original = makeDrizzleQueryError();
    const appErr = toAppError(original);

    logServerError(
      appErr,
      { requestId: "r1", method: "POST", path: "/api/workouts/complete" },
      original,
    );
    await vi.waitFor(() => expect(captureException).toHaveBeenCalled());

    const logged = errorSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).not.toContain(SECRET_HR);
    expect(logged).not.toContain("params:");
    expect(logged).not.toContain("Failed query");
  });

  it("Sentry.captureException otrzymuje błąd zastępczy, nie oryginalny DrizzleQueryError", async () => {
    const original = makeDrizzleQueryError();
    const appErr = toAppError(original);

    logServerError(
      appErr,
      { requestId: "r2", method: "PUT", path: "/api/active-workout-session" },
      original,
    );
    await vi.waitFor(() => expect(captureException).toHaveBeenCalledTimes(1));

    const [sentryArg] = captureException.mock.calls[0]!;
    const serialized = `${(sentryArg as Error)?.message ?? ""} ${(sentryArg as Error)?.stack ?? ""}`;
    expect(serialized).not.toContain(SECRET_HR);
    expect(serialized).not.toContain("params:");
    expect(serialized).not.toContain("Failed query");
    expect(sentryArg).not.toBe(original);
  });
});
