import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
const assertCsrf = vi.fn((): NextResponse | null => null);
const checkRateLimitAsync = vi.fn(async () => ({ ok: true as const, retryAfterSec: 0 }));
const upsertFriendLivePresence = vi.fn();
const clearFriendLivePresence = vi.fn(async () => undefined);
const notifyStart = vi.fn(async () => undefined);

vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/csrf", () => ({ assertCsrf }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitAsync,
  rateLimitKey: () => "k",
}));
vi.mock("@/lib/community/friend-live", () => ({
  upsertFriendLivePresence,
  clearFriendLivePresence,
}));
vi.mock("@/lib/community/notifications", () => ({
  notifyMutualShareFriendsOnWorkoutStart: notifyStart,
}));

const { POST } = await import("@/app/api/community/friends/live/presence/route");

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/community/friends/live/presence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/community/friends/live/presence (US13 / Z37)", () => {
  beforeEach(() => {
    auth.mockReset().mockResolvedValue({ user: { id: "u1" } });
    assertCsrf.mockReset().mockReturnValue(null);
    upsertFriendLivePresence.mockReset();
    notifyStart.mockClear();
  });

  it("trening solo (brak udostępniania) → 204, nie 403", async () => {
    upsertFriendLivePresence.mockResolvedValue({
      ok: false,
      error: "Brak wzajemnego udostępniania treningu.",
    });
    const res = await post({ active: true, presence: {}, notifyStart: true });
    expect(res.status).toBe(204);
    expect(notifyStart).not.toHaveBeenCalled();
  });

  it("przy udostępnianiu zapisuje obecność i odpowiada 200", async () => {
    upsertFriendLivePresence.mockResolvedValue({ ok: true });
    const res = await post({ active: true, presence: {} });
    expect(res.status).toBe(200);
  });

  it("niezalogowany nadal dostaje 401", async () => {
    auth.mockResolvedValue(null);
    expect((await post({ active: true })).status).toBe(401);
  });
});
