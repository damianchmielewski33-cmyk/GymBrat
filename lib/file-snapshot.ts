/**
 * Android WebView często oddaje „żywy” File z inputa.
 * Reset `input.value = ""` albo opóźniony FormData zeruje bajty (size 0 → 400).
 */
export async function snapshotFile(file: File): Promise<File> {
  const buf = await file.arrayBuffer();
  const name = (file.name || "").trim() || "plik";
  return new File([buf], name, {
    type: file.type || "application/octet-stream",
    lastModified: file.lastModified || Date.now(),
  });
}

export async function snapshotFiles(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const f of files) {
    try {
      out.push(await snapshotFile(f));
    } catch {
      out.push(f);
    }
  }
  return out;
}

export function isLikelyEmptyUpload(file: Pick<File, "size"> | null | undefined): boolean {
  return !file || file.size <= 0;
}
