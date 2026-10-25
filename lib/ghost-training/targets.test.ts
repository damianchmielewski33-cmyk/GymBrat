import { describe, expect, it } from "vitest";
import { loadGhostTimelineForTarget } from "@/lib/ghost-training/targets";

describe("loadGhostTimelineForTarget — V-1 IDOR (kind spoza self/friend/leader)", () => {
  it("zwraca null dla nieznanej wartości kind, nawet gdy workoutId należy do innego użytkownika", async () => {
    const result = await loadGhostTimelineForTarget({
      viewerId: "userB",
      // Rzutowanie symuluje pominięcie walidacji zod w route (np. wywołanie
      // wewnętrzne albo przyszła zmiana, która zapomni o `z.enum`).
      kind: "x" as "self" | "friend" | "leader",
      userId: "userA",
      workoutId: "wA",
    });
    expect(result).toBeNull();
  });

  it("zwraca null dla pustego stringa jako kind", async () => {
    const result = await loadGhostTimelineForTarget({
      viewerId: "userB",
      kind: "" as "self" | "friend" | "leader",
      userId: "userA",
      workoutId: "wA",
    });
    expect(result).toBeNull();
  });
});
