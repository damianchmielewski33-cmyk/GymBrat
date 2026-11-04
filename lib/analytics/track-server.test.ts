import { beforeEach, describe, expect, it, vi } from "vitest";

const isConsentGranted = vi.fn(async (_u: string, _t: string) => false);
const posthogCapture = vi.fn(async () => undefined);

vi.mock("@/lib/consents", () => ({ isConsentGranted }));
vi.mock("@/lib/analytics/posthog", () => ({ posthogCapture }));

const { track } = await import("@/lib/analytics/track-server");

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("Z12: zdarzenia PostHog z serwera tylko po zgodzie", () => {
  beforeEach(() => {
    isConsentGranted.mockReset().mockResolvedValue(false);
    posthogCapture.mockClear();
  });

  it("bez zgody `analytics` nic nie wychodzi", async () => {
    track.teamCreated("u1", { team_id: "t1" } as never);
    await flush();
    expect(posthogCapture).not.toHaveBeenCalled();
    expect(isConsentGranted).toHaveBeenCalledWith("u1", "analytics");
  });

  it("ze zgodą zdarzenie jest wysyłane", async () => {
    isConsentGranted.mockResolvedValue(true);
    track.teamCreated("u1", { team_id: "t1" } as never);
    await flush();
    expect(posthogCapture).toHaveBeenCalledTimes(1);
  });

  it.each(["anonymous", "system:team:t1", ""])("konto %j nie jest śledzone", async (id) => {
    isConsentGranted.mockResolvedValue(true);
    track.teamCreated(id, { team_id: "t1" } as never);
    await flush();
    expect(posthogCapture).not.toHaveBeenCalled();
  });

  it("błąd bazy przy sprawdzaniu zgody nie wysyła zdarzenia ani nie rzuca", async () => {
    isConsentGranted.mockRejectedValue(new Error("db down"));
    track.teamCreated("u1", { team_id: "t1" } as never);
    await flush();
    expect(posthogCapture).not.toHaveBeenCalled();
  });
});
