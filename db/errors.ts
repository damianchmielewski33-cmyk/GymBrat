/** Naruszenie unikalności SQLite/libSQL (także opakowane przez Drizzle w `cause`). */
export function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e instanceof Error; e = e.cause) {
    if (/UNIQUE constraint failed/i.test(e.message)) return true;
  }
  return false;
}
