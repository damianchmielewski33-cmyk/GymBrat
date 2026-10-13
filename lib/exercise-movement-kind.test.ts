import { describe, expect, it } from "vitest";
import {
  easySetsRequiredForWeightBump,
  inferMovementKind,
} from "@/lib/exercise-movement-kind";

describe("exercise-movement-kind", () => {
  it("klasyfikuje izolację po kategorii i nazwie", () => {
    expect(inferMovementKind("Curl", "biceps")).toBe("isolation");
    expect(inferMovementKind("Rozpiętki", "chest")).toBe("isolation");
    expect(inferMovementKind("Przysiad", "quads")).toBe("compound");
    expect(inferMovementKind("Wyciskanie sztangi", "chest")).toBe("compound");
  });

  it("izolacja wymaga 3 łatwych przed +kg", () => {
    expect(easySetsRequiredForWeightBump("isolation")).toBe(3);
    expect(easySetsRequiredForWeightBump("compound")).toBe(2);
  });
});
