import { describe, expect, it } from "vitest";
import { isIgnorableSchemaConflict } from "./migrate";

describe("isIgnorableSchemaConflict", () => {
  it("akceptuje duplicate column z LibsqlBatchError (arm_cm)", () => {
    const err = new Error(
      "SQLITE_UNKNOWN: SQLITE_UNKNOWN: SQLite error: duplicate column name: arm_cm",
    );
    err.name = "LibsqlBatchError";
    expect(isIgnorableSchemaConflict(err)).toBe(true);
  });

  it("akceptuje already exists dla tabeli i indeksu", () => {
    expect(
      isIgnorableSchemaConflict(
        new Error("SQLite error: table daily_checkins already exists"),
      ),
    ).toBe(true);
    expect(
      isIgnorableSchemaConflict(
        new Error("index idx_meal_logs_user_date already exists"),
      ),
    ).toBe(true);
  });

  it("nie maskuje innych błędów SQL", () => {
    expect(
      isIgnorableSchemaConflict(new Error("SQLITE_ERROR: no such table: users")),
    ).toBe(false);
    expect(isIgnorableSchemaConflict(new Error("network timeout"))).toBe(false);
  });
});
