import { describe, expect, it } from "vitest";
import { presignUrl } from "@/lib/object-storage-sigv4";

describe("SigV4 presign (wektor z dokumentacji AWS S3)", () => {
  it("zgadza się z przykładowym podpisem GET", () => {
    const url = presignUrl({
      method: "GET",
      url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
      creds: {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        region: "us-east-1",
      },
      expiresSeconds: 86400,
      now: new Date("2013-05-24T00:00:00Z"),
    });
    expect(url).toContain(
      "X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404",
    );
  });
});
