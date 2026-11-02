import { buildUserDataExport } from "@/lib/user-data-export";

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Jeden arkusz: `record` rozróżnia wiersze. Trening: exercises_json w kolumnie payload.
 */
export async function buildUserDataCsv(userId: string): Promise<string> {
  const d = await buildUserDataExport(userId);
  const header = [
    "record",
    "date",
    "col3",
    "col4",
    "col5",
    "col6",
    "col7",
  ].join(",");
  const lines: string[] = [header];

  for (const w of d.workouts) {
    const row = w as Record<string, unknown>;
    const exercises =
      typeof row.exercises === "string" ? row.exercises : JSON.stringify(row.exercises ?? "");
    lines.push(
      [
        csvCell("workout"),
        csvCell(String(row.date ?? "")),
        csvCell(row.workoutPlanId != null ? String(row.workoutPlanId) : ""),
        csvCell(row.cardioMinutes != null ? String(row.cardioMinutes) : ""),
        csvCell(exercises),
        csvCell(""),
        csvCell(""),
      ].join(","),
    );
  }

  for (const m of d.mealLogs) {
    const row = m as Record<string, unknown>;
    lines.push(
      [
        csvCell("meal"),
        csvCell(String(row.date ?? "")),
        csvCell(row.name != null ? String(row.name) : ""),
        csvCell(row.calories != null ? String(row.calories) : ""),
        csvCell(row.proteinG != null ? String(row.proteinG) : ""),
        csvCell(row.fatG != null ? String(row.fatG) : ""),
        csvCell(row.carbsG != null ? String(row.carbsG) : ""),
      ].join(","),
    );
  }

  for (const o of d.orders) {
    const row = o as Record<string, unknown>;
    lines.push(
      [
        csvCell("order"),
        csvCell(String(row.paidAt ?? row.createdAt ?? "")),
        csvCell(row.planSku != null ? String(row.planSku) : ""),
        csvCell(row.amountGrosze != null ? String(row.amountGrosze) : ""),
        csvCell(row.status != null ? String(row.status) : ""),
        csvCell(row.receiptNumber != null ? String(row.receiptNumber) : ""),
        csvCell(""),
      ].join(","),
    );
  }

  // CSV to skrót (treningi, posiłki, zamówienia); pozostałe dane — w eksporcie JSON (art. 20 RODO).
  for (const [table, rows] of Object.entries(d.otherData)) {
    lines.push(
      [csvCell("other"), csvCell(""), csvCell(table), csvCell(String(rows.length)), "", "", ""].join(","),
    );
  }

  return lines.join("\r\n");
}
