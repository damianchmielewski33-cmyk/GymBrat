import { describe, expect, it } from "vitest";
import { SENSITIVE_CONSENT_TEXT_VERSION } from "@/lib/consents-client";
import { LEGAL_DOCS_APPROVED_BY_LAWYER, LEGAL_VERSIONS } from "@/lib/legal-versions";
import { ORDER_TERMS_VERSION, orderConsentCanonicalText } from "@/lib/order-consents";

describe("wersje tekstów prawnych (Z15)", () => {
  it("zgody w kodzie używają wersji z jednego źródła", () => {
    expect(ORDER_TERMS_VERSION).toBe(LEGAL_VERSIONS.orderTerms);
    expect(SENSITIVE_CONSENT_TEXT_VERSION).toBe(LEGAL_VERSIONS.sensitiveConsents);
    expect(orderConsentCanonicalText().startsWith(LEGAL_VERSIONS.orderTerms)).toBe(true);
  });

  it("dopóki prawnik nie zatwierdził, wersje są oznaczone jako szkic (i odwrotnie)", () => {
    const labelled = Object.values(LEGAL_VERSIONS).every((v) => v.includes("szkic"));
    expect(labelled).toBe(!LEGAL_DOCS_APPROVED_BY_LAWYER);
  });
});
