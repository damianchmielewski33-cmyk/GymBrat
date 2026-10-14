import type { WorkoutPlanPayload } from "@/lib/workout-plan-types";
import { buildSupersetLabels } from "@/lib/start-workout-session";

export type PrintablePlan = {
  id: string;
  plan: WorkoutPlanPayload;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function planToHtml(plans: PrintablePlan[]): string {
  const blocks = plans
    .map(({ plan }) => {
      const labels = buildSupersetLabels(plan.exercises);
      const name = plan.planName.trim() || "Plan treningowy";
      const rows = plan.exercises
        .map((ex, i) => {
          const tag = labels[ex.id] ? `${labels[ex.id]} ` : "";
          const sets = typeof ex.sets === "number" && ex.sets > 0 ? ex.sets : 3;
          const meta = [
            `${sets}s × ${ex.reps}p`,
            ex.rir != null ? `RIR ${ex.rir}` : null,
            ex.tempo ? `tempo ${ex.tempo}` : null,
          ]
            .filter(Boolean)
            .join(" · ");
          const note = ex.note?.trim()
            ? `<div class="note">${escapeHtml(ex.note.trim())}</div>`
            : "";
          return `<tr>
            <td class="n">${i + 1}</td>
            <td><strong>${escapeHtml(tag)}${escapeHtml(ex.name)}</strong>${note}</td>
            <td class="meta">${escapeHtml(meta)}</td>
          </tr>`;
        })
        .join("");
      return `<section class="plan">
        <h1>${escapeHtml(name)}</h1>
        <p class="sub">${plan.exercises.length} ćwiczeń · GymBrat</p>
        <table>
          <thead><tr><th>#</th><th>Ćwiczenie</th><th>Schemat</th></tr></thead>
          <tbody>${rows || "<tr><td colspan='3'>Brak ćwiczeń</td></tr>"}</tbody>
        </table>
      </section>`;
    })
    .join('<div class="break"></div>');

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Plan treningowy — GymBrat</title>
<style>
  @page { margin: 16mm; }
  body { font-family: system-ui, Segoe UI, sans-serif; color: #111; margin: 0; padding: 12px; background: #fff; }
  .toolbar { display: flex; gap: 8px; margin: 0 0 16px; flex-wrap: wrap; }
  .toolbar button {
    appearance: none; border: 0; border-radius: 999px; padding: 10px 16px;
    font-size: 14px; font-weight: 600; cursor: pointer;
    background: #ebc44a; color: #111;
  }
  .toolbar button.secondary { background: #eee; color: #333; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #555; font-size: 12px; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #666; }
  .n { width: 28px; color: #888; }
  .meta { white-space: nowrap; color: #333; }
  .note { margin-top: 4px; font-size: 12px; color: #555; }
  .break { page-break-after: always; height: 0; }
  @media print {
    body { padding: 0; }
    .toolbar { display: none !important; }
  }
</style>
</head>
<body>
<div class="toolbar">
  <button type="button" onclick="window.print()">Drukuj / Zapisz PDF</button>
</div>
${blocks}
</body>
</html>`;
}

/**
 * Otwiera plan w nowej karcie (treść + druk / Zapisz PDF).
 * Blob URL — bez `noopener` + `document.write` (na Androidzie/WebView dawało pustą stronę).
 */
export function printWorkoutPlans(plans: PrintablePlan[]): boolean {
  if (typeof window === "undefined") return false;
  const list = plans.filter((p) => p?.plan != null);
  if (list.length === 0) return false;

  const html = planToHtml(list);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const opened = window.open(url, "_blank");
  if (!opened) {
    // Popup zablokowany — ta sama karta.
    window.location.assign(url);
  }

  window.setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }, 120_000);

  return true;
}
