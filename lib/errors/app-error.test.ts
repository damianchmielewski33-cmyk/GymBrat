import { describe, expect, it } from "vitest";
import {
  isDrizzleQueryError,
  sanitizeDrizzleQueryError,
  toAppError,
} from "@/lib/errors/app-error";

/**
 * Regresja F-1 (`docs/bezpieczenstwo/005-koniec-treningu-przeplyw.md`): `drizzle-orm`
 * owija każdy błąd zapytania w `DrizzleQueryError`, którego `.message`/`.stack` zawierają
 * pełne SQL + WARTOŚCI parametrów (ciężary, tętno, kalorie, kroki, cały JSON sesji).
 * Te testy wymuszają taki błąd z rozpoznawalnym, syntetycznym "tętnem" i sprawdzają, że
 * żadna ścieżka logowania/klasyfikacji go nie przenosi dalej.
 */
const SECRET_HR = "SYNTH-HR-151-SECRET";

function makeDrizzleQueryError(causeMessage?: string) {
  const query = `insert into "workouts" ("id","user_id","exercises") values (?, ?, ?)`;
  const params = `t-1,,{"kind":"completed_session","cardio":{"avgHr":"${SECRET_HR}"}}`;
  const err = Object.assign(new Error(`Failed query: ${query}\nparams: ${params}`), {
    query,
    params,
    ...(causeMessage ? { cause: new Error(causeMessage) } : {}),
  }) as Error & { query: string; params: unknown; cause?: unknown };
  return err;
}

describe("isDrizzleQueryError", () => {
  it("rozpoznaje błąd po własnych polach query/params (duck typing, bez instanceof)", () => {
    expect(isDrizzleQueryError(makeDrizzleQueryError())).toBe(true);
  });

  it("nie rozpoznaje zwykłego Error ani wartości nie-Error", () => {
    expect(isDrizzleQueryError(new Error("plain"))).toBe(false);
    expect(isDrizzleQueryError("string")).toBe(false);
    expect(isDrizzleQueryError(null)).toBe(false);
    expect(isDrizzleQueryError(undefined)).toBe(false);
  });
});

describe("toAppError — DrizzleQueryError (F-1)", () => {
  it("nigdy nie przenosi SQL ani parametrów do AppError.message", () => {
    const appErr = toAppError(
      makeDrizzleQueryError(
        "SQLITE_CONSTRAINT: UNIQUE constraint failed: workouts.user_id, workouts.operation_id",
      ),
    );
    expect(appErr.message).not.toContain(SECRET_HR);
    expect(appErr.message).not.toContain("Failed query");
    expect(appErr.message).not.toContain("params:");
    expect(appErr.code).toBe("INTERNAL");
    // Komunikat sterownika (bez wartości, tylko nazwy kolumn) jest dozwolony w logu.
    expect(appErr.message).toContain("UNIQUE constraint failed");
  });

  it("gdy brak bezpiecznego komunikatu sterownika, wraca do stałego tekstu", () => {
    const appErr = toAppError(makeDrizzleQueryError());
    expect(appErr.message).not.toContain(SECRET_HR);
    expect(appErr.message).toBe("Błąd zapytania do bazy danych.");
  });

  it("klasyfikuje SERVICE_UNAVAILABLE po komunikacie sterownika (cause), nie po SQL/params", () => {
    const appErr = toAppError(makeDrizzleQueryError("SQLITE_BUSY: database is locked"));
    expect(appErr.code).toBe("SERVICE_UNAVAILABLE");
    expect(appErr.message).not.toContain(SECRET_HR);
  });

  it("odrzuca komunikat sterownika, który sam wyglądałby na wyciek (defensywnie)", () => {
    const appErr = toAppError(
      makeDrizzleQueryError(`coś zawierające params: ${SECRET_HR}`),
    );
    expect(appErr.message).not.toContain(SECRET_HR);
    expect(appErr.message).toBe("Błąd zapytania do bazy danych.");
  });
});

describe("sanitizeDrizzleQueryError", () => {
  it("buduje błąd zastępczy, którego message i stack nie zawierają SQL/parametrów", () => {
    const safe = sanitizeDrizzleQueryError(makeDrizzleQueryError("SQLITE_BUSY: database is locked"));
    expect(safe.message).not.toContain(SECRET_HR);
    expect(safe.message).not.toContain("Failed query");
    expect(safe.stack ?? "").not.toContain(SECRET_HR);
    expect(safe.stack ?? "").not.toContain("Failed query");
  });
});

describe("toAppError — SyntaxError z JSON.parse (F-1, część c)", () => {
  it("nie przenosi fragmentu nieudanego parsowania do AppError.message", () => {
    let syntaxErr: SyntaxError;
    try {
      JSON.parse(`{"cardio":{"avgHr":"${SECRET_HR}"`);
      throw new Error("powinno rzucić");
    } catch (e) {
      syntaxErr = e as SyntaxError;
    }
    const appErr = toAppError(syntaxErr);
    expect(appErr.code).toBe("INVALID_JSON");
    expect(appErr.message).not.toContain(SECRET_HR);
  });
});
