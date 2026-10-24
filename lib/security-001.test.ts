import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveEffectiveRole } from "@/lib/admin-config";
import { isTokenRevoked, type AccountAuthState } from "@/lib/account-auth-state";
import {
  signTakeoverToken,
  TAKEOVER_TOKEN_TTL_MS,
  verifyTakeoverToken,
} from "@/lib/account-takeover";
import { decideOAuthSignIn, type OAuthDecisionInput } from "@/lib/oauth-link-policy";
import { getRegisterEmailMode } from "@/lib/register-email-mode";

/**
 * Testy bezpieczeństwa zadania 001 (etap 9): macierze wyczerpujące i przypadki brzegowe,
 * które uzupełniają testy funkcjonalne obok kodu.
 */

const SECRET = "security-test-secret";
const NOW = 1_800_000_000_000;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("tryb kodu rejestracji: tryb testowy tylko lokalnie (macierz)", () => {
  const nodeEnvs = ["production", "development", "test", "staging", "", undefined, "Production", "DEVELOPMENT"];
  const markers = [undefined, "", "1", "true", "0", "false"];
  const smtpOptions = [false, true];

  it("`test` wyłącznie dla NODE_ENV development/test, bez SMTP i bez znaczników hostingu", () => {
    for (const nodeEnv of nodeEnvs) {
      for (const vercel of markers) {
        for (const render of markers) {
          for (const smtp of smtpOptions) {
            const env: Record<string, string> = {};
            if (nodeEnv !== undefined) env.NODE_ENV = nodeEnv;
            if (vercel !== undefined) env.VERCEL = vercel;
            if (render !== undefined) env.RENDER = render;
            if (smtp) Object.assign(env, { SMTP_HOST: "h", SMTP_USER: "u", SMTP_PASS: "p" });
            const mode = getRegisterEmailMode(env as NodeJS.ProcessEnv);

            const local = nodeEnv === "development" || nodeEnv === "test";
            const hosted = Boolean(vercel) || Boolean(render);
            const expected = smtp ? "smtp" : local && !hosted ? "test" : "disabled";
            expect(mode, JSON.stringify(env)).toBe(expected);
          }
        }
      }
    }
  });

  it("żadna kombinacja bez SMTP z NODE_ENV=production nie daje trybu testowego", () => {
    for (const extra of [{}, { MOCK_REGISTER_EMAIL_CODE: "1" }, { RENDER: "true" }, { VERCEL: "1" }]) {
      expect(getRegisterEmailMode({ NODE_ENV: "production", ...extra } as NodeJS.ProcessEnv)).toBe(
        "disabled",
      );
    }
  });
});

describe("decyzja OAuth: niezmienniki (macierz wyczerpująca)", () => {
  const bools = [false, true];
  const accounts: OAuthDecisionInput["accountByEmail"][] = [
    null,
    { id: "a", emailVerified: true, isAdmin: false },
    { id: "a", emailVerified: false, isAdmin: false },
    { id: "a", emailVerified: false, isAdmin: true },
    { id: "a", emailVerified: true, isAdmin: true },
  ];

  function all(): OAuthDecisionInput[] {
    const out: OAuthDecisionInput[] = [];
    for (const provider of ["google", "facebook"] as const) {
      for (const email of ["", "x@example.com"]) {
        for (const providerEmailVerified of bools) {
          for (const linkedUserId of [null, "owner"]) {
            for (const accountByEmail of accounts) {
              out.push({ provider, email, providerEmailVerified, linkedUserId, accountByEmail });
            }
          }
        }
      }
    }
    return out;
  }

  it("Facebook nigdy nie łączy ani nie przejmuje konta po e-mailu", () => {
    for (const input of all().filter((i) => i.provider === "facebook" && !i.linkedUserId)) {
      const d = decideOAuthSignIn(input);
      expect(["link_existing", "takeover_confirm"], JSON.stringify(input)).not.toContain(d.kind);
    }
  });

  it("Google bez potwierdzonego e-maila nigdy nie łączy, nie przejmuje i nie tworzy konta", () => {
    for (const input of all().filter(
      (i) => i.provider === "google" && !i.providerEmailVerified && !i.linkedUserId && i.email,
    )) {
      expect(decideOAuthSignIn(input), JSON.stringify(input)).toEqual({
        kind: "reject",
        code: "OAuthEmailUnverified",
      });
    }
  });

  it("odmowa dla Google bez potwierdzenia jest identyczna dla istniejącego i nieistniejącego konta", () => {
    const base = {
      provider: "google" as const,
      email: "x@example.com",
      providerEmailVerified: false,
      linkedUserId: null,
    };
    const results = accounts.map((accountByEmail) => decideOAuthSignIn({ ...base, accountByEmail }));
    expect(new Set(results.map((r) => JSON.stringify(r))).size).toBe(1);
  });

  it("konto admin bez weryfikacji nigdy nie trafia do przejęcia", () => {
    for (const input of all().filter(
      (i) => i.accountByEmail?.isAdmin && !i.accountByEmail.emailVerified && !i.linkedUserId,
    )) {
      expect(decideOAuthSignIn(input).kind, JSON.stringify(input)).not.toBe("takeover_confirm");
    }
  });

  it("istniejące powiązanie zawsze wygrywa i wskazuje właściciela powiązania", () => {
    for (const input of all().filter((i) => i.linkedUserId)) {
      expect(decideOAuthSignIn(input)).toEqual({ kind: "login_linked", userId: "owner" });
    }
  });

  it("link_existing i takeover_confirm tylko dla Google z potwierdzonym adresem", () => {
    for (const input of all()) {
      const kind = decideOAuthSignIn(input).kind;
      if (kind === "link_existing" || kind === "takeover_confirm") {
        expect(input.provider).toBe("google");
        expect(input.providerEmailVerified).toBe(true);
        expect(input.email).not.toBe("");
      }
    }
  });
});

describe("rola admina: tylko zweryfikowany e-mail z ADMIN_EMAILS", () => {
  it("niezweryfikowany adres z listy nie daje admina, także z inną wielkością liter i spacjami", () => {
    vi.stubEnv("ADMIN_EMAILS", " Owner@Example.com , other@example.com ");
    for (const email of ["owner@example.com", "OWNER@EXAMPLE.COM", " owner@example.com "]) {
      expect(resolveEffectiveRole({ appRole: "zawodnik", email, emailVerified: false })).toBe(
        "zawodnik",
      );
      expect(resolveEffectiveRole({ appRole: "zawodnik", email, emailVerified: true })).toBe("admin");
    }
  });

  it("pusta lista i adresy spoza listy nie dają admina (brak adresu w kodzie)", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(
      resolveEffectiveRole({ appRole: "zawodnik", email: "damianchmielewski33@gmail.com", emailVerified: true }),
    ).toBe("zawodnik");
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
    expect(
      resolveEffectiveRole({ appRole: "zawodnik", email: "owner+x@example.com", emailVerified: true }),
    ).toBe("zawodnik");
    expect(resolveEffectiveRole({ appRole: null, email: null, emailVerified: true })).toBe("zawodnik");
  });

  it("rola zapisana w bazie nie zależy od weryfikacji (udokumentowane ryzyko: konta sprzed wdrożenia)", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(resolveEffectiveRole({ appRole: "admin", email: "a@b.pl", emailVerified: false })).toBe("admin");
  });
});

describe("token przejęcia: odporność na manipulacje", () => {
  function setup() {
    vi.stubEnv("AUTH_SECRET", SECRET);
    return signTakeoverToken({ uid: "u1", pid: "g1" }, NOW);
  }

  it("przedłużenie exp bez przeliczenia podpisu jest odrzucone", () => {
    const token = setup();
    const [body, sig] = token.split(".");
    const payload = JSON.parse(Buffer.from(body!, "base64url").toString());
    payload.exp += 3_600_000;
    const forged = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(verifyTakeoverToken(`${forged}.${sig}`, NOW)).toBeNull();
  });

  it("podpis bez prefiksu domenowego `takeover:` nie jest akceptowany (separacja kontekstów)", () => {
    const token = setup();
    const [body] = token.split(".");
    const otherContext = createHmac("sha256", SECRET).update(body!).digest("base64url");
    expect(verifyTakeoverToken(`${body}.${otherContext}`, NOW)).toBeNull();
  });

  it("podpis poprawny, ale ładunek spoza schematu (brak uid, exp jako tekst/ułamek) jest odrzucony", () => {
    setup();
    for (const payload of [
      { pid: "g1", exp: NOW + 1000 },
      { uid: "u1", pid: "g1", exp: String(NOW + 1000) },
      { uid: "u1", pid: "g1", exp: NOW + 1000.5 },
      { uid: "", pid: "g1", exp: NOW + 1000 },
      { uid: "u1", pid: "g1", exp: -1 },
      [],
      null,
    ]) {
      const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const sig = createHmac("sha256", SECRET).update(`takeover:${body}`).digest("base64url");
      expect(verifyTakeoverToken(`${body}.${sig}`, NOW), JSON.stringify(payload)).toBeNull();
    }
  });

  it("nie rzuca wyjątku dla śmieci i podpisów o innej długości", () => {
    const token = setup();
    const [body] = token.split(".");
    for (const candidate of ["", ".", "..", "a.", ".b", `${body}.`, `${body}.AAAA`, "%%%.%%%", "x".repeat(5000)]) {
      expect(() => verifyTakeoverToken(candidate, NOW)).not.toThrow();
      expect(verifyTakeoverToken(candidate, NOW)).toBeNull();
    }
  });

  it("granica ważności: dokładnie 10 minut wygasa", () => {
    const token = setup();
    expect(verifyTakeoverToken(token, NOW + TAKEOVER_TOKEN_TTL_MS - 1)).not.toBeNull();
    expect(verifyTakeoverToken(token, NOW + TAKEOVER_TOKEN_TTL_MS)).toBeNull();
  });

  it("bez AUTH_SECRET weryfikacja zwraca null, a podpisanie rzuca (fail-closed)", () => {
    const token = setup();
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NEXTAUTH_SECRET", "");
    expect(verifyTakeoverToken(token, NOW)).toBeNull();
    expect(() => signTakeoverToken({ uid: "u1", pid: "g1" }, NOW)).toThrow();
  });

  it("ładunek tokenu nie zawiera e-maila ani imienia", () => {
    const token = setup();
    const body = Buffer.from(token.split(".")[0]!, "base64url").toString();
    expect(Object.keys(JSON.parse(body)).sort()).toEqual(["exp", "pid", "uid"]);
  });
});

describe("unieważnianie sesji: przypadki brzegowe", () => {
  const state = (over: Partial<AccountAuthState> = {}): AccountAuthState => ({
    exists: true,
    email: "a@b.pl",
    appRole: "zawodnik",
    emailVerified: true,
    sessionVersion: 0,
    ...over,
  });

  it("niepoprawny `sv` w tokenie (tekst, NaN, null) jest traktowany jak 0 i nie omija podbitej wersji", () => {
    for (const sv of ["0", Number.NaN, null, undefined, {}, []]) {
      expect(isTokenRevoked({ id: "u", sv }, state({ sessionVersion: 1 })), String(sv)).toBe(true);
    }
  });

  it("brak identyfikatora w tokenie i brak konta unieważniają sesję", () => {
    expect(isTokenRevoked({ sv: 0 }, state())).toBe(true);
    expect(isTokenRevoked({ id: "", sv: 0 }, state())).toBe(true);
    expect(isTokenRevoked({ id: "u", sv: 0 }, state({ exists: false }))).toBe(true);
  });
});
