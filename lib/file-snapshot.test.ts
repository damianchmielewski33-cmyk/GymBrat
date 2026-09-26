import { describe, expect, it } from "vitest";
import { isLikelyEmptyUpload, snapshotFile } from "@/lib/file-snapshot";

describe("snapshotFile", () => {
  it("kopiuje bajty do niezależnego File", async () => {
    const src = new File([new Uint8Array([1, 2, 3, 4])], "plan.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const copy = await snapshotFile(src);
    expect(copy).not.toBe(src);
    expect(copy.size).toBe(4);
    expect(copy.name).toBe("plan.xlsx");
    expect(new Uint8Array(await copy.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
  });
});

describe("isLikelyEmptyUpload", () => {
  it("wykrywa pusty plik", () => {
    expect(isLikelyEmptyUpload(null)).toBe(true);
    expect(isLikelyEmptyUpload(new File([], "a.xlsx"))).toBe(true);
    expect(isLikelyEmptyUpload(new File([new Uint8Array([1])], "a.xlsx"))).toBe(false);
  });
});
