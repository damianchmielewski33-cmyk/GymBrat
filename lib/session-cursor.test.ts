import { describe, expect, it } from "vitest";
import {
  countSessionSets,
  findLastCompletedSet,
  findNextIncompleteSet,
  formatCompactClock,
  formatKgPl,
  formatSetScheme,
} from "@/lib/session-cursor";

const ex = [
  {
    id: "1",
    name: "A",
    sets: [{ done: true }, { done: false }],
  },
  {
    id: "2",
    name: "B",
    sets: [{ done: false }],
  },
];

describe("session cursor", () => {
  it("wskazuje następną nieukończoną serię", () => {
    expect(findNextIncompleteSet(ex)).toEqual({ exerciseIndex: 0, setIndex: 1 });
  });

  it("wskazuje ostatnią ukończoną serię", () => {
    expect(findLastCompletedSet(ex)).toEqual({ exerciseIndex: 0, setIndex: 0 });
  });

  it("liczy serie", () => {
    expect(countSessionSets(ex)).toEqual({ done: 1, total: 3 });
  });

  it("formatuje zegar i kilogramy", () => {
    expect(formatCompactClock(85)).toBe("1:25");
    expect(formatKgPl(12.5)).toBe("12,5");
  });

  it("formatuje schemat serii", () => {
    expect(formatSetScheme(2, 10)).toBe("2s 10p");
  });
});
