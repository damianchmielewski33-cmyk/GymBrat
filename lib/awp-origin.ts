/** Domyślny origin Akademii Wielkich Piłkarzy (siostrzana aplikacja, wspólne konto). */
export const DEFAULT_AWP_ORIGIN = "https://akademia-wielkich-pilkarzy.vercel.app";

/** Publiczny origin AWP (bez końcowego „/”). */
export function getAwpOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_AWP_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      /* ignore */
    }
  }
  return DEFAULT_AWP_ORIGIN;
}

/** Czy Origin/Referer należy do zaufanego hosta AWP (SSO / postMessage). */
export function isTrustedAwpOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  try {
    const o = new URL(origin).origin;
    if (o === getAwpOrigin()) return true;
    // Lokalny / preview AWP
    if (
      o === "http://localhost:3000" ||
      o === "http://127.0.0.1:3000" ||
      o === "http://10.0.2.2:3000"
    ) {
      return true;
    }
    const host = new URL(o).hostname;
    if (host.endsWith(".vercel.app") && host.includes("akademia")) return true;
    return false;
  } catch {
    return false;
  }
}
