import { describe, expect, it } from "vitest";
import { registerSchema } from "@/lib/validations/register";

const valid = {
  firstName: "Zażółć",
  lastName: "Gęślą-Jaźń",
  email: "a@example.com",
  emailCode: "123456",
  password: "haslo1234",
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

  it.each(["1234", "12345", "1234567", "12 456", "abcdef", "", "12345a"])(
    "odrzuca kod %j (tylko 6 cyfr)",
    (emailCode) => {
      expect(registerSchema.safeParse({ ...valid, emailCode }).success).toBe(false);
    },
  );

  it("przycina białe znaki wokół kodu", () => {
    expect(registerSchema.safeParse({ ...valid, emailCode: " 123456 " }).success).toBe(true);
  });

  it.each([
    ["weightKg", "29"],
    ["weightKg", "401"],
    ["weightKg", "-5"],
    ["weightKg", "0"],
    ["heightCm", "99"],
    ["heightCm", "180.5"],
    ["age", "12"],
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
