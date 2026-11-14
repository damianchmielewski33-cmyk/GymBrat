import { describe, expect, it } from "vitest";
import { registerSchema } from "@/lib/validations/register";

const valid = {
  firstName: "Zażółć",
  lastName: "Gęślą-Jaźń",
  email: "a@example.com",
  password: "haslo1234",
  confirmPassword: "haslo1234",
  weightKg: "80",
  heightCm: "180",
  age: "30",
  activityLevel: "medium",
  weeklySessionsTarget: "3",
  role: "zawodnik",
};

describe("registerSchema (US-1, BR-1)", () => {
  it("przyjmuje poprawne dane z polskimi znakami", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("odrzuca różne hasła w polach hasło i powtórz hasło", () => {
    const r = registerSchema.safeParse({ ...valid, confirmPassword: "inne-haslo1" });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("obwody są opcjonalne: puste pola przechodzą, wartości są liczbami", () => {
    const empty = registerSchema.safeParse({ ...valid, abdomenCm: "", chestCm: "", armCm: "" });
    expect(empty.success).toBe(true);
    const filled = registerSchema.safeParse({ ...valid, abdomenCm: "88,5".replace(",", "."), chestCm: "102", armCm: "36" });
    expect(filled.success && filled.data.abdomenCm).toBe(88.5);
  });

  it.each([
    ["abdomenCm", "10"],
    ["chestCm", "300"],
    ["armCm", "abc"],
  ])("odrzuca obwód %s=%j", (field, value) => {
    expect(registerSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });

  it.each([
    ["weightKg", "29"],
    ["weightKg", "401"],
    ["weightKg", "-5"],
    ["weightKg", "0"],
    ["heightCm", "99"],
    ["heightCm", "180.5"],
    ["age", "12"],
    ["age", "15"],
    ["age", "121"],
    ["weeklySessionsTarget", "0"],
    ["weeklySessionsTarget", "8"],
    ["password", "krotkie"],
    ["email", "bez-malpy"],
    ["firstName", "   "],
  ])("odrzuca %s=%j", (field, value) => {
    expect(registerSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });
});
