export type UploadBlob = Blob & { name?: string; type?: string };

export function isUploadBlob(v: unknown): v is UploadBlob {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Blob).arrayBuffer === "function" &&
    typeof (v as Blob).size === "number"
  );
}

/** Android / serwer czasem oddaje Blob pod inną nazwą pola niż `file`. */
export function pickUploadBlob(
  form: Pick<FormData, "get" | "entries">,
): { blob: UploadBlob | null; filenameHint: string } {
  const filenameHint = String(form.get("filename") ?? "").trim();
  const direct = form.get("file");
  if (isUploadBlob(direct)) {
    return { blob: direct, filenameHint };
  }
  for (const [, value] of form.entries()) {
    if (isUploadBlob(value)) {
      return { blob: value, filenameHint };
    }
  }
  return { blob: null, filenameHint };
}

export function resolveUploadName(blob: UploadBlob, filenameHint: string): string {
  if (typeof blob.name === "string" && blob.name.trim()) return blob.name.trim();
  return filenameHint;
}
