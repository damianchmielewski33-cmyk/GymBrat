import "server-only";

import { getObjectText } from "@/lib/object-storage";

/** Z39: zapisany ładunek zdjęcia — z bazy (`data_url`) albo z magazynu obiektowego (`object_key`). */
export async function loadStoredPhotoPayload(p: {
  dataUrl: string | null;
  objectKey?: string | null;
}): Promise<string> {
  if (p.objectKey) {
    try {
      return (await getObjectText(p.objectKey)) ?? "";
    } catch {
      return "";
    }
  }
  return p.dataUrl ?? "";
}
