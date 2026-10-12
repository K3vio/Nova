import { drizzle } from "drizzle-orm/libsql";
import { getDatabaseConfig } from "./config";
import * as schema from "./schema";

function createDb() {
  return drizzle({ connection: getDatabaseConfig(), schema });
}

// Reuse one client across hot reloads in development.
const globalForDb = globalThis as unknown as {
  novaDb?: ReturnType<typeof createDb>;
};

export const db = globalForDb.novaDb ?? createDb();

if (process.env.NODE_ENV !== "production") globalForDb.novaDb = db;

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
