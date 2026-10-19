import { collectRenderMeters, getRenderConfig } from "@/lib/monitoring/render-metrics";
import { collectTursoMeters, getTursoConfig } from "@/lib/monitoring/turso-usage";
import type { MonitoringSnapshot } from "@/lib/monitoring/types";

export async function collectMonitoringSnapshot(
  opts?: { force?: boolean },
): Promise<MonitoringSnapshot> {
  const [render, turso] = await Promise.all([
    collectRenderMeters(opts),
    collectTursoMeters(opts),
  ]);

  const hints: string[] = [];
  if (!getRenderConfig()) {
    hints.push(
      "Render: dodaj RENDER_API_KEY + RENDER_SERVICE_ID (opcjonalnie RENDER_BANDWIDTH_LIMIT_GB, domyślnie 5).",
    );
  }
  if (!getTursoConfig()) {
    hints.push(
      "Turso: dodaj TURSO_API_TOKEN (Platform API) + TURSO_ORG_SLUG.",
    );
  }
  if (render.error) hints.push(`Render: ${render.error}`);
  if (turso.error) hints.push(`Turso: ${turso.error}`);

  return {
    updatedAt: new Date().toISOString(),
    meters: [...render.meters, ...turso.meters],
    hints,
  };
}
