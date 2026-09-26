import { describe, expect, it } from "vitest";
import { pickUploadBlob, resolveUploadName } from "@/lib/workout-plan-upload";

describe("pickUploadBlob", () => {
  it("bierze file + filename", () => {
    const form = new FormData();
    form.set(
      "file",
      new File([new Uint8Array([80, 75])], "plan.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    form.set("filename", "Plan-treningowy.xlsx");
    const { blob, filenameHint } = pickUploadBlob(form);
    expect(blob).not.toBeNull();
    expect(blob!.size).toBe(2);
    expect(filenameHint).toBe("Plan-treningowy.xlsx");
    expect(resolveUploadName(blob!, filenameHint)).toBe("plan.xlsx");
  });

  it("znajduje Blob pod inną nazwą pola", () => {
    const form = new FormData();
    form.set("upload", new File([new Uint8Array([1, 2, 3])], "a.xlsx"));
    const { blob } = pickUploadBlob(form);
    expect(blob?.size).toBe(3);
  });
});
