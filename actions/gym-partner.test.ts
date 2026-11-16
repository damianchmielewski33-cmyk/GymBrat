import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  userId: "u1" as string | null,
  premium: false,
  send: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/auth", () => ({
  auth: async () => (m.userId ? { user: { id: m.userId } } : null),
}));
vi.mock("@/lib/action-guard", () => ({ guardAction: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/user-package", () => ({ isPremiumActive: async () => m.premium }));
vi.mock("@/db", () => ({ getDb: () => ({ insert: () => ({ values: async () => {} }) }) }));
vi.mock("@/lib/gym-partner/presence", () => ({
  clearPresence: async () => {},
  listNearbyPartners: async () => [],
  respondToRequest: async () => ({ ok: true }),
  sendRequest: m.send,
  setPresence: async () => ({}),
}));

import {
  listNearbyPartnersAction,
  sendPartnerRequestAction,
  startSharingAction,
  stopSharingAction,
} from "@/actions/gym-partner";

describe("gym-partner: bramka Premium", () => {
  beforeEach(() => {
    m.userId = "u1";
    m.premium = false;
    m.send.mockClear();
  });

  it("bez Premium każda akcja odmawia i nie dotyka danych", async () => {
    const results = [
      await startSharingAction({}),
      await stopSharingAction(),
      await listNearbyPartnersAction({ lat: 52, lng: 21 }),
      await sendPartnerRequestAction("u2"),
    ];
    for (const r of results) {
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toContain("Premium");
    }
    expect(m.send).not.toHaveBeenCalled();
  });

  it("bez sesji odmawia", async () => {
    m.userId = null;
    const r = await sendPartnerRequestAction("u2");
    expect(r.ok).toBe(false);
  });

  it("z Premium przechodzi i waliduje dane", async () => {
    m.premium = true;
    expect((await sendPartnerRequestAction("u2")).ok).toBe(true);
    expect((await listNearbyPartnersAction({ lat: 999, lng: 0 })).ok).toBe(false);
    expect((await listNearbyPartnersAction({ lat: 52, lng: 21 })).ok).toBe(true);
  });
});
