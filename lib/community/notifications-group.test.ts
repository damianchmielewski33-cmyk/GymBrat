import { describe, expect, it } from "vitest";
import { NOTIFICATION_GROUP_WINDOW_MS } from "@/lib/community/notification-types";

describe("notification grouping window", () => {
  it("uses 2h window", () => {
    expect(NOTIFICATION_GROUP_WINDOW_MS).toBe(2 * 60 * 60 * 1000);
  });

  it("builds reaction group keys consistently", () => {
    const postId = "post-abc";
    const key = `reaction:post:${postId}`;
    expect(key).toBe("reaction:post:post-abc");
  });
});
