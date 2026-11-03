import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { isAdmin2faSatisfied, isAdminEligible } from "@/lib/admin-session";

/** Kod błędu, gdy admin nie przeszedł 2FA (UI przekierowuje na /admin/2fa). */
export const ADMIN_2FA_REQUIRED_CODE = "ADMIN_2FA_REQUIRED";

export async function requireAdminApi(opts: { skip2fa?: boolean } = {}): Promise<
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const eligible = await isAdminEligible(session);
  if (!eligible) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  if (!opts.skip2fa && !(await isAdmin2faSatisfied(session))) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Wymagana weryfikacja dwuskładnikowa (2FA).", code: ADMIN_2FA_REQUIRED_CODE },
        { status: 403 },
      ),
    };
  }
  return { ok: true, session };
}
