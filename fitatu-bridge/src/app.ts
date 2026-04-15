import { Hono } from "hono";
import { cors } from "hono/cors";
import { createSession, getSession } from "./session.js";
import { mockDiary } from "./modes/mock.js";
import { forwardDiary, forwardLogin } from "./modes/forward.js";
import { fileDiary } from "./modes/file.js";

export type BridgeMode = "mock" | "forward" | "file";

function getMode(): BridgeMode {
  const m = (process.env.BRIDGE_MODE ?? "mock").toLowerCase();
  if (m === "forward" || m === "file") return m;
  return "mock";
}

function bearer(c: { req: { header: (n: string) => string | undefined } }) {
  const a = c.req.header("authorization") ?? c.req.header("Authorization");
  if (!a?.toLowerCase().startsWith("bearer ")) return null;
  return a.slice(7).trim();
}

export function createApp() {
  const app = new Hono();
  const origins =
    process.env.CORS_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

  if (origins.length) {
    app.use(
      "*",
      cors({
        origin: origins,
        allowHeaders: ["Authorization", "Content-Type", "Accept"],
        allowMethods: ["GET", "POST", "OPTIONS"],
      }),
    );
  }

  app.get("/health", (c) =>
    c.json({ ok: true, mode: getMode(), service: "fitatu-bridge" }),
  );

  app.post("/auth/login", async (c) => {
    let body: { email?: string; password?: string };
    try {
      body = (await c.req.json()) as { email?: string; password?: string };
    } catch {
      return c.json({ message: "Oczekiwano JSON { email, password }." }, 400);
    }
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) {
      return c.json({ message: "Pola email i password są wymagane." }, 400);
    }

    const mode = getMode();
    try {
      if (mode === "forward") {
        const { upstreamToken } = await forwardLogin(email, password);
        const s = createSession({ email, upstreamToken });
        return c.json({ accessToken: s.bridgeToken });
      }
      const s = createSession({ email });
      return c.json({ accessToken: s.bridgeToken });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Logowanie nie powiodło się.";
      return c.json({ message }, 401);
    }
  });

  app.get("/diary/:date", async (c) => {
    const date = c.req.param("date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json({ message: "Nieprawidłowy format daty (YYYY-MM-DD)." }, 400);
    }

    const token = bearer(c);
    if (!token) {
      return c.json({ message: "Brak nagłówka Authorization: Bearer …" }, 401);
    }

    const session = getSession(token);
    if (!session) {
      return c.json({ message: "Nieprawidłowy lub wygasły token mostu." }, 401);
    }

    const mode = getMode();
    try {
      if (mode === "mock") {
        return c.json(mockDiary(date, session.email));
      }
      if (mode === "file") {
        return c.json(await fileDiary(date));
      }
      if (!session.upstreamToken) {
        return c.json({ message: "Brak tokena upstream — zaloguj ponownie." }, 401);
      }
      return c.json(await forwardDiary(date, session.upstreamToken));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Błąd pobierania dziennika.";
      return c.json({ message }, 502);
    }
  });

  return app;
}
