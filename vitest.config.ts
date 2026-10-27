import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // one throwaway mongod for the whole run; tests never reach the shared Atlas cluster
    globalSetup: ["./src/test/mongo-global-setup.ts"],
    setupFiles: ["./src/test/setup.ts"],
    // test files share that mongod and reseed it, so they must not interleave
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
