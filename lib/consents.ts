import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userConsents } from "@/db/schema";
import {
  CONSENT_SOURCES,
  CONSENT_TYPES,
  CURRENT_CONSENT_TEXT_VERSION,
  type ConsentSource,
  type ConsentType,
} from "@/lib/consents-client";

export {
  CONSENT_SOURCES,
  CONSENT_TYPES,
  CURRENT_CONSENT_TEXT_VERSION,
  type ConsentSource,
  type ConsentType,
};

export type CurrentConsent = {
  type: ConsentType;
  granted: boolean;
  textVersion: string;
  source: string;
  decidedAt: Date;
};

export type CurrentConsentsMap = Partial<
  Record<ConsentType, CurrentConsent>
>;

/** Najnowszy wiersz per typ — append-only `user_consents`. */
export async function getCurrentConsents(
  userId: string,
): Promise<CurrentConsentsMap> {
  const db = getDb();
  const out: CurrentConsentsMap = {};
  for (const type of CONSENT_TYPES) {
    const [row] = await db
      .select({
        type: userConsents.type,
        granted: userConsents.granted,
        textVersion: userConsents.textVersion,
        source: userConsents.source,
        decidedAt: userConsents.decidedAt,
      })
      .from(userConsents)
      .where(
        and(eq(userConsents.userId, userId), eq(userConsents.type, type)),
      )
      .orderBy(desc(userConsents.decidedAt))
      .limit(1);
    if (row && (row.type === "analytics" || row.type === "marketing")) {
      out[row.type] = {
        type: row.type,
        granted: Boolean(row.granted),
        textVersion: row.textVersion,
        source: row.source,
        decidedAt: row.decidedAt,
      };
    }
  }
  return out;
}

export function isConsentType(v: string): v is ConsentType {
  return (CONSENT_TYPES as readonly string[]).includes(v);
}

export function isConsentSource(v: string): v is ConsentSource {
  return (CONSENT_SOURCES as readonly string[]).includes(v);
}
