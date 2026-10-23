/* eslint-disable @typescript-eslint/no-unused-vars -- handlery testowe muszą mieć parametr `_req` dla typów */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { errorResponse, withApiErrors } from "@/lib/errors/api";
import { AppError } from "@/lib/errors/app-error";
import { ERROR_CATALOG } from "@/lib/errors/catalog";
import { classifyThrown, describeApiError } from "@/lib/errors/client";

function req(path = "/api/test?token=secret", init?: RequestInit) {
  return new Request(`https://gym-brat.test${path}`, init);
}

describe("withApiErrors", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it("nie rusza poprawnych odpowiedzi", async () => {
    const res = await withApiErrors((_req: Request) => Response.json({ ok: true }))(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("wyjątek → 500 z bezpiecznym komunikatem, kodem i ref; loguje stack bez query", async () => {
    const res = await withApiErrors((_req: Request) => {
      throw new Error("SECRET internal detail");
    })(req());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body).toMatchObject({
      ok: false,
      code: "INTERNAL",
      status: 500,
      error: ERROR_CATALOG.INTERNAL.message,
    });
    expect(JSON.stringify(body)).not.toContain("SECRET");
    expect(body.requestId).toBeTruthy();
    expect(res.headers.get("x-request-id")).toBe(body.requestId);

    const logged = error.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain("[GymBrat][serwer][500][INTERNAL] GET /api/test");
    expect(logged).toContain(`ref ${body.requestId}`);
    expect(logged).toContain("SECRET internal detail");
    expect(logged).not.toContain("token=secret");
  });

  it("ZodError → 400 VALIDATION_FAILED z fieldErrors", async () => {
    const res = await withApiErrors((_req: Request) => {
      z.object({ sku: z.string().min(1) }).parse({ sku: "" });
      return Response.json({});
    })(req("/api/x", { method: "POST" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.fieldErrors.sku).toBeTruthy();
    expect(warn).toHaveBeenCalled();
  });

  it("AppError z retryAfter → 429 z nagłówkiem Retry-After", async () => {
    const res = await withApiErrors((_req: Request) => {
      throw new AppError("RATE_LIMITED", { retryAfterSec: 30 });
    })(req());
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
  });

  it("ujednolica angielskie ciało błędu zwrócone przez trasę", async () => {
    const res = await withApiErrors((_req: Request) =>
      Response.json({ ok: false, error: "Unauthorized" }, { status: 401 }),
    )(req());
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(body.error).toBe(ERROR_CATALOG.UNAUTHORIZED.message);
    expect(body.requestId).toBeTruthy();
  });

  it("zachowuje własny polski komunikat trasy i nagłówki, dopisuje kod", async () => {
    const res = await withApiErrors((_req: Request) =>
        new Response(JSON.stringify({ error: "Wybierz pakiet." }), {
          status: 400,
          headers: { "content-type": "application/json", "x-custom": "1" },
        }),
    )(req());
    const body = await res.json();
    expect(body).toMatchObject({ error: "Wybierz pakiet.", code: "BAD_REQUEST", status: 400 });
    expect(res.headers.get("x-custom")).toBe("1");
  });

  it("odpowiedzi nie-JSON przechodzą bez zmian, ale są logowane", async () => {
    const res = await withApiErrors((_req: Request) => new Response("ERR", { status: 400 }))(req());
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("ERR");
    expect(warn).toHaveBeenCalled();
  });

  it("błąd 5xx zwrócony przez trasę trafia do logu jako błąd", async () => {
    await withApiErrors((_req: Request) => Response.json({ error: "Nie udało się." }, { status: 503 }))(req());
    expect(String(error.mock.calls[0]?.[0])).toContain("[503][SERVICE_UNAVAILABLE]");
  });

  it("przepuszcza redirect/notFound z Next.js", async () => {
    const control = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;/login" });
    await expect(
      withApiErrors((_req: Request) => {
        throw control;
      })(req()),
    ).rejects.toBe(control);
  });

  it("przerwane połączenie klienta → 499 bez logu błędu", async () => {
    const controller = new AbortController();
    controller.abort();
    const res = await withApiErrors((_req: Request) => {
      throw new Error("aborted");
    })(req("/api/x", { signal: controller.signal }));
    expect(res.status).toBe(499);
    expect(error).not.toHaveBeenCalled();
  });

  it("zachowuje argumenty handlera (kontekst z params)", async () => {
    const handler = withApiErrors(async (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
      Response.json({ id: (await ctx.params).id }),
    );
    const res = await handler(req(), { params: Promise.resolve({ id: "42" }) });
    expect(await res.json()).toEqual({ id: "42" });
  });
});

describe("errorResponse", () => {
  it("buduje jednolite ciało błędu", async () => {
    const res = errorResponse("NOT_FOUND", { requestId: "r1" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      ok: false,
      error: ERROR_CATALOG.NOT_FOUND.message,
      code: "NOT_FOUND",
      status: 404,
      requestId: "r1",
    });
  });
});

describe("klient: klasyfikacja błędów", () => {
  it("mapuje typowe wyjątki przeglądarki", () => {
    expect(classifyThrown(new TypeError("Failed to fetch")).code).toBe("NETWORK");
    expect(classifyThrown(new TypeError("Load failed")).code).toBe("NETWORK");
    const chunk = new Error("Loading chunk 12 failed.");
    chunk.name = "ChunkLoadError";
    expect(classifyThrown(chunk).code).toBe("CHUNK_LOAD");
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(classifyThrown(abort).ignore).toBe(true);
    expect(classifyThrown(new Error("ResizeObserver loop limit exceeded")).ignore).toBe(true);
    expect(classifyThrown(new RangeError("x")).code).toBe("CLIENT_RUNTIME");
    expect(classifyThrown(undefined).code).toBe("UNKNOWN");
  });

  it("błąd z digestem (serwer) → INTERNAL z kodem referencyjnym", () => {
    const err = Object.assign(new Error("An error occurred in the Server Components render."), {
      digest: "1234567",
    });
    expect(classifyThrown(err)).toMatchObject({ code: "INTERNAL", digest: "1234567" });
  });

  it("obiekt ze statusem HTTP mapuje się na kod", () => {
    expect(classifyThrown({ status: 429, error: "Zbyt wiele prób." })).toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("describeApiError wybiera komunikat z katalogu lub bezpieczny z API", () => {
    expect(describeApiError(500, { error: "TypeError: boom" }).message).toBe(
      ERROR_CATALOG.INTERNAL.message,
    );
    expect(describeApiError(404, {}).code).toBe("NOT_FOUND");
    expect(describeApiError(400, { error: "Wybierz pakiet.", requestId: "r9" })).toMatchObject({
      message: "Wybierz pakiet.",
      requestId: "r9",
    });
    expect(describeApiError(403, { error: "Sesja bezpieczeństwa wygasła" }).code).toBe("CSRF_FAILED");
  });
});
