import { presignUrl, type S3Credentials } from "./object-storage-sigv4.ts";

/** Z39: limity zdjęć trzymanych w magazynie obiektowym. */
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const PHOTO_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

type StorageConfig = {
  endpoint: string;
  bucket: string;
  pathStyle: boolean;
  creds: S3Credentials;
};

export function getObjectStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): StorageConfig | null {
  if (env.PHOTO_STORAGE?.trim().toLowerCase() !== "s3") return null;
  const endpoint = env.OBJECT_STORAGE_ENDPOINT?.trim();
  const bucket = env.OBJECT_STORAGE_BUCKET?.trim();
  const accessKeyId = env.OBJECT_STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.OBJECT_STORAGE_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    bucket,
    // R2/MinIO: path-style; AWS: virtual-hosted gdy OBJECT_STORAGE_PATH_STYLE=0
    pathStyle: env.OBJECT_STORAGE_PATH_STYLE?.trim() !== "0",
    creds: {
      accessKeyId,
      secretAccessKey,
      region: env.OBJECT_STORAGE_REGION?.trim() || "auto",
    },
  };
}

export function isObjectStorageEnabled(): boolean {
  return getObjectStorageConfig() !== null;
}

function objectUrl(cfg: StorageConfig, key: string): URL {
  const base = new URL(cfg.endpoint);
  const safeKey = key.split("/").map(encodeURIComponent).join("/");
  if (cfg.pathStyle) {
    base.pathname = `/${cfg.bucket}/${safeKey}`;
  } else {
    base.hostname = `${cfg.bucket}.${base.hostname}`;
    base.pathname = `/${safeKey}`;
  }
  return base;
}

/** Podpisany URL na krótki czas (np. bezpośredni PUT z klienta dla danych niezaszyfrowanych). */
export function presignObjectUrl(
  method: "GET" | "PUT" | "DELETE",
  key: string,
  expiresSeconds = 300,
): string {
  const cfg = getObjectStorageConfig();
  if (!cfg) throw new Error("object_storage_disabled");
  return presignUrl({
    method,
    url: objectUrl(cfg, key),
    creds: cfg.creds,
    expiresSeconds: Math.min(900, Math.max(30, expiresSeconds)),
  });
}

export function assertPhotoWithinLimits(bytes: number, mime?: string): void {
  if (bytes <= 0 || bytes > PHOTO_MAX_BYTES) throw new Error("photo_too_large");
  if (mime && !(PHOTO_ALLOWED_MIME as readonly string[]).includes(mime)) {
    throw new Error("photo_bad_type");
  }
}

export async function putObject(
  key: string,
  body: string | Uint8Array,
  contentType = "application/octet-stream",
): Promise<void> {
  const size = typeof body === "string" ? Buffer.byteLength(body) : body.byteLength;
  // Obiekt może być zaszyfrowaną reprezentacją (tekst) — limit obejmuje narzut base64.
  if (size <= 0 || size > Math.ceil(PHOTO_MAX_BYTES * 1.5)) {
    throw new Error("photo_too_large");
  }
  const res = await fetch(presignObjectUrl("PUT", key, 60), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: typeof body === "string" ? body : Buffer.from(body),
  });
  if (!res.ok) throw new Error(`object_put_failed_${res.status}`);
}

export async function getObjectText(key: string): Promise<string | null> {
  const res = await fetch(presignObjectUrl("GET", key, 60));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`object_get_failed_${res.status}`);
  return res.text();
}

export async function deleteObject(key: string): Promise<void> {
  const res = await fetch(presignObjectUrl("DELETE", key, 60), {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`object_delete_failed_${res.status}`);
  }
}
