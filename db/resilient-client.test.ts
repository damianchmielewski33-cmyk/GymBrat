import { describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import { isReadOnlyStatement, withResilientRetry } from "@/db/resilient-client";
import { isTransientDbError } from "@/db/with-retry";

const hangUp = () =>
  Object.assign(new Error("request to https://x.turso.io/v2/pipeline failed, reason: socket hang up"), {
    code: "ECONNRESET",
  });

function fakeClient(execute: Client["execute"]): Client {
  return {
    execute,
    batch: vi.fn(async () => []),
    close: vi.fn(),
  } as unknown as Client;
}

describe("isReadOnlyStatement", () => {
  it("rozpoznaje odczyty i zapisy", () => {
    expect(isReadOnlyStatement("select 1")).toBe(true);
    expect(isReadOnlyStatement({ sql: "  SELECT * FROM t", args: [] })).toBe(true);
    expect(isReadOnlyStatement("PRAGMA page_count")).toBe(true);
    expect(isReadOnlyStatement("with a as (select 1) select * from a")).toBe(true);
    expect(isReadOnlyStatement("insert into t values (1)")).toBe(false);
    expect(isReadOnlyStatement("with a as (select 1) delete from t")).toBe(false);
  });
});

describe("isTransientDbError z cause", () => {
  it("rozpoznaje błąd sieciowy ukryty w cause (Failed query)", () => {
    const wrapped = new Error("Failed query: select 1", { cause: hangUp() });
    expect(isTransientDbError(wrapped)).toBe(true);
  });
});

describe("withResilientRetry", () => {
  it("ponawia odczyt po socket hang up", async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(hangUp())
      .mockResolvedValueOnce({ rows: [] });
    const client = withResilientRetry(fakeClient(execute as unknown as Client["execute"]));
    await expect(client.execute("select 1")).resolves.toEqual({ rows: [] });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("nie ponawia zapisu po ECONNRESET (mógł się wykonać)", async () => {
    const execute = vi.fn().mockRejectedValue(hangUp());
    const client = withResilientRetry(fakeClient(execute as unknown as Client["execute"]));
    await expect(client.execute("insert into t values (1)")).rejects.toThrow(/socket hang up/);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("ponawia zapis, gdy połączenie nie zostało nawiązane", async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("connect failed"), { code: "ECONNREFUSED" }))
      .mockResolvedValueOnce({ rows: [] });
    const client = withResilientRetry(fakeClient(execute as unknown as Client["execute"]));
    await expect(client.execute("update t set a = 1")).resolves.toEqual({ rows: [] });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("nie ponawia błędów logicznych (np. składnia)", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("SQLITE_ERROR: syntax error"));
    const client = withResilientRetry(fakeClient(execute as unknown as Client["execute"]));
    await expect(client.execute("select nope")).rejects.toThrow(/syntax/);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("poddaje się po 3 próbach", async () => {
    const execute = vi.fn().mockRejectedValue(hangUp());
    const client = withResilientRetry(fakeClient(execute as unknown as Client["execute"]));
    await expect(client.execute("select 1")).rejects.toThrow(/socket hang up/);
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it("przekazuje pozostałe metody klienta bez zmian", () => {
    const base = fakeClient(vi.fn() as unknown as Client["execute"]);
    const client = withResilientRetry(base);
    client.close();
    expect(base.close).toHaveBeenCalled();
  });
});
