import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/messages/en";
import { pl } from "@/lib/i18n/messages/pl";
import { formatMessage } from "@/lib/i18n/format";

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

describe("i18n dictionaries", () => {
  it("pl i en mają te same klucze (diet / admin / session / profileAi)", () => {
    const plKeys = flattenKeys(pl as unknown as Record<string, unknown>).sort();
    const enKeys = flattenKeys(en as unknown as Record<string, unknown>).sort();
    expect(enKeys).toEqual(plKeys);
    expect(plKeys.some((k) => k.startsWith("diet."))).toBe(true);
    expect(plKeys.some((k) => k.startsWith("session."))).toBe(true);
    expect(plKeys.some((k) => k.startsWith("profileAi."))).toBe(true);
  });

  it("profileAi.body nie łączy propozycji posiłków z modelem AI", () => {
    expect(pl.profileAi.body.toLowerCase()).toContain("katalog");
    expect(pl.profileAi.body.toLowerCase()).toMatch(/nie z modelu|nie z modelu ai|nie z modelu/);
    expect(en.profileAi.body.toLowerCase()).toContain("catalog");
    expect(en.profileAi.body.toLowerCase()).toContain("not from an ai model");
  });

  it("formatMessage podstawia placeholdery", () => {
    expect(formatMessage("OK · {count}", { count: 12 })).toBe("OK · 12");
  });
});
