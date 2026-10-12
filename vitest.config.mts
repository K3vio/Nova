import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Each run gets its own throwaway database file; never the real one.
    env: { DATABASE_URL: `file:${join(tmpdir(), `nova-test-${randomUUID()}.db`)}` },
    setupFiles: ["./src/test/setup.ts"],
    fileParallelism: false,
  },
});
