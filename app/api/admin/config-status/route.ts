import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import {
  CONFIG_GROUP_LABELS,
  getConfigStatus,
  summarizeConfig,
} from "@/lib/admin-config-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stan konfiguracji środowiska — tylko „ustawione / brak”, nigdy wartości. */
async function handleGET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const integrations = getConfigStatus();
  const res = NextResponse.json({
    ok: true,
    groups: CONFIG_GROUP_LABELS,
    integrations,
    summary: summarizeConfig(integrations),
  });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const GET = withApiErrors(handleGET);
