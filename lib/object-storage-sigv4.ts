import { createHash, createHmac } from "node:crypto";

export type S3Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

const sha256Hex = (v: string | Uint8Array) =>
  createHash("sha256").update(v).digest("hex");
const hmac = (key: string | Buffer, data: string) =>
  createHmac("sha256", key).update(data).digest();

const enc = (s: string) =>
  encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

export function amzDate(d: Date): { date: string; datetime: string } {
  const iso = d.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { datetime: iso, date: iso.slice(0, 8) };
}

function signingKey(secret: string, date: string, region: string) {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), "s3"), "aws4_request");
}

/** Podpisany URL (query-string SigV4, payload UNSIGNED-PAYLOAD). `url` bez query. */
export function presignUrl(opts: {
  method: "GET" | "PUT" | "DELETE";
  url: URL;
  creds: S3Credentials;
  expiresSeconds: number;
  now?: Date;
}): string {
  const { datetime, date } = amzDate(opts.now ?? new Date());
  const scope = `${date}/${opts.creds.region}/s3/aws4_request`;
  const params: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${opts.creds.accessKeyId}/${scope}`],
    ["X-Amz-Date", datetime],
    ["X-Amz-Expires", String(opts.expiresSeconds)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const query = params
    .map(([k, v]) => [enc(k), enc(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const canonicalPath = opts.url.pathname
    .split("/")
    .map((seg) => enc(decodeURIComponent(seg)))
    .join("/");
  const canonical = [
    opts.method,
    canonicalPath,
    query,
    `host:${opts.url.host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const toSign = [
    "AWS4-HMAC-SHA256",
    datetime,
    scope,
    sha256Hex(canonical),
  ].join("\n");
  const signature = createHmac(
    "sha256",
    signingKey(opts.creds.secretAccessKey, date, opts.creds.region),
  )
    .update(toSign)
    .digest("hex");
  return `${opts.url.origin}${canonicalPath}?${query}&X-Amz-Signature=${signature}`;
}
