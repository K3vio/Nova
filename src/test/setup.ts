import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, beforeEach } from "vitest";
import { db } from "@/db";
import { conversations, goals } from "@/db/schema";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});

beforeEach(async () => {
  // Steps, progress entries and chat messages cascade from these.
  await db.delete(goals);
  await db.delete(conversations);
});
