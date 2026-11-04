import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  guardAction: vi.fn(async (_name: string) => undefined),
  compute: vi.fn(async (_userId: string, _input: unknown) => ({ ok: false as const, error: "x" })),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/action-guard", () => ({ guardAction: mocks.guardAction }));
vi.mock("@/lib/strength-overview-service", () => ({
  computeStrengthOverview: mocks.compute,
}));
// Pozostałe loadery nie są tu potrzebne — mock odcina ciężkie importy.
vi.mock("@/lib/progress-metrics/body", () => ({ loadProgressBodyMetrics: vi.fn() }));
vi.mock("@/lib/progress-metrics/overview", () => ({ loadProgressOverviewMetrics: vi.fn() }));
vi.mock("@/lib/progress-metrics/strength", () => ({ loadProgressStrengthMetrics: vi.fn() }));
vi.mock("@/lib/progress-metrics/week", () => ({ loadProgressWeekMetrics: vi.fn() }));

const { getStrengthOverviewAction } = await import("@/actions/progress-metrics");

describe("getStrengthOverviewAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bez sesji odrzuca żądanie i nie liczy niczego", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(getStrengthOverviewAction({ preset: "30" })).rejects.toThrow("Sesja wygasła.");
    expect(mocks.compute).not.toHaveBeenCalled();
  });

  it("wywołuje guard z nazwą akcji i przekazuje userId z sesji (nie z wejścia)", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "session-user" } });
        const input = { preset: "30", userId: "podszywanie" };
    await getStrengthOverviewAction(input);
    expect(mocks.guardAction).toHaveBeenCalledWith("progress.metrics.strength-overview");
    expect(mocks.compute).toHaveBeenCalledWith("session-user", input);
  });
});
