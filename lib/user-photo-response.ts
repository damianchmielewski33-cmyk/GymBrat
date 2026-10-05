import "server-only";

import { dataUrlToBuffer } from "@/lib/app-branding-parse";

const PRIVATE_IMAGE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  "X-Content-Type-Options": "nosniff",
} as const;

export function imageResponseFromDataUrl(dataUrl: string): Response | null {
  const parsed = dataUrlToBuffer(dataUrl);
  if (!parsed) return null;
  return new Response(new Uint8Array(parsed.body), {
    status: 200,
    headers: {
      ...PRIVATE_IMAGE_HEADERS,
      "Content-Type": parsed.mimeType,
    },
  });
}
