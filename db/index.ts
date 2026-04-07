import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type Database = LibSQLDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  libsql?: Client;
  drizzle?: Database;
};

function createLibsqlClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error(
      "Missing TURSO_DATABASE_URL. Use file:./local.db for local dev or your Turso URL on Vercel.",
    );
  }
  const token = process.env.TURSO_AUTH_TOKEN;
  return createClient({
    url,
    ...(token ? { authToken: token } : {}),
  });
}

export function getDb(): Database {
  if (globalForDb.drizzle) return globalForDb.drizzle;
  const client = globalForDb.libsql ?? createLibsqlClient();
  if (process.env.NODE_ENV !== "production") {
    globalForDb.libsql = client;
  }
  const db = drizzle(client, { schema });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.drizzle = db;
  }
  return db;
}
