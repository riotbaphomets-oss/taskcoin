import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    resolve: {
      alias: {
        "@": path.resolve(process.cwd(), "src"),
        // "server-only" wirft außerhalb von Next.js, im Test wird es durch eine leere Datei ersetzt.
        "server-only": path.resolve(process.cwd(), "tests/stubs/server-only.ts"),
      },
    },
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"],
      globalSetup: ["./tests/global-setup.ts"],
      fileParallelism: false, // alle Tests teilen sich eine Datenbank
      testTimeout: 30_000,
      env: {
        DATABASE_URL: env.TEST_DATABASE_URL ?? process.env.TEST_DATABASE_URL ?? "",
        AUTH_SECRET: "test-secret-test-secret-test-secret-123456",
      },
    },
  };
});
