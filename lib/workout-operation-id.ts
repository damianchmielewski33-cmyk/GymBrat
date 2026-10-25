/**
 * Klucz idempotencji zapisu treningu (ADR 0004 p.13, pivot po B-1c/B-1d).
 * Wyliczany deterministycznie z (workoutPlanId, startedAtMs) — NIE generowany
 * losowo i NIE synchronizowany jako stan przez chmurę. Dwa urządzenia wznawiające
 * tę samą logiczną sesję mają już ten sam `workoutStartedAtMs` (kopiowany wprost
 * przez `applyCloudPayload`, bez udziału tej funkcji) — więc wyliczają ten sam klucz
 * NIEZALEŻNIE, bez żadnej komunikacji. Nowa sesja (`start()`) dostaje nowy
 * `workoutStartedAtMs`, więc automatycznie nowy klucz — bez osobnej logiki
 * "regeneruj tylko przy nowym starcie" (ta logika, `ensureOperationId` w store,
 * jest usuwana razem z polem `operationId` ze store).
 *
 * `userId` NIE wchodzi do klucza: unikalność jest wymuszana razem z `userId`
 * przez indeks `(userId, operationId)` w `workouts` (ADR p.1) — dodanie go tu
 * tylko skomplikowałoby wywołanie z klienta (trzeba by przekazywać
 * `session.user.id` do czystej funkcji w `lib/`) bez żadnej korzyści.
 *
 * Format: UUID v5 (RFC 4122, SHA-1, stała przestrzeń nazw) — zgodny bez zmian
 * z `z.string().uuid()` w `/api/workouts/complete` i z kontraktem Androida.
 */
const NAMESPACE_HEX = "a1f1a0a0-6f2e-5f0a-9c1b-0b7b7c2b9b11"; // stała aplikacji, bez znaczenia bezpieczeństwa

export async function deriveWorkoutOperationId(
  workoutPlanId: string | null,
  startedAtMs: number,
): Promise<string> {
  const name = `${workoutPlanId ?? "none"}:${Math.round(startedAtMs)}`;
  const namespaceBytes = hexToBytes(NAMESPACE_HEX.replace(/-/g, ""));
  const nameBytes = new TextEncoder().encode(name);
  const data = new Uint8Array(namespaceBytes.length + nameBytes.length);
  data.set(namespaceBytes, 0);
  data.set(nameBytes, namespaceBytes.length);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", data));
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // wersja 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // wariant RFC 4122
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
