export function formatMinutes(total: number) {
  const m = Math.max(0, Math.round(total));
  return `${m} min`;
}
