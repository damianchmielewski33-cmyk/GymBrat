import { describe, expect, it } from "vitest";
import { isFromAcademyQuery } from "@/lib/iframe-embed";

describe("iframe-embed", () => {
  it("rozpoznaje ?from=awp", () => {
    expect(isFromAcademyQuery("?from=awp")).toBe(true);
    expect(isFromAcademyQuery("from=awp&x=1")).toBe(true);
    expect(isFromAcademyQuery("?from=admin")).toBe(false);
    expect(isFromAcademyQuery("")).toBe(false);
  });
});
