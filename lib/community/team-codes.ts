const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 8-znakowy kod bez mylących 0/O/1/I. */
export function generateTeamInviteCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (let i = 0; i < length; i++) {
    out += INVITE_ALPHABET[bytes[i]! % INVITE_ALPHABET.length];
  }
  return out;
}

export function normalizeTeamInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function generateInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
