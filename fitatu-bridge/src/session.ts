export type BridgeSession = {
  /** Token zwrócony do GymBrat (Bearer). */
  bridgeToken: string;
  /** Token sesji u upstreamie (jeśli tryb forward). */
  upstreamToken?: string;
  email: string;
  createdAt: number;
};

const sessions = new Map<string, BridgeSession>();
const TTL_MS = 1000 * 60 * 60 * 24 * 14;

function randomToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function createSession(partial: Omit<BridgeSession, "bridgeToken" | "createdAt">) {
  prune();
  const bridgeToken = randomToken();
  const row: BridgeSession = {
    bridgeToken,
    createdAt: Date.now(),
    ...partial,
  };
  sessions.set(bridgeToken, row);
  return row;
}

export function getSession(bridgeToken: string) {
  prune();
  return sessions.get(bridgeToken) ?? null;
}

export function deleteSession(bridgeToken: string) {
  sessions.delete(bridgeToken);
}

function prune() {
  const now = Date.now();
  for (const [k, v] of sessions) {
    if (now - v.createdAt > TTL_MS) sessions.delete(k);
  }
}
