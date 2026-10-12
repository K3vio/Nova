import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, beforeEach } from "vitest";
import { db } from "@/db";
import { goals } from "@/db/schema";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});

beforeEach(async () => {
  // Steps and progress entries cascade from goals.
  await db.delete(goals);
});
