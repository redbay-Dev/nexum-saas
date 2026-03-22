import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

// Load env so we can derive the test DB URL from the dev one
loadEnv({ path: resolve(__dirname, "../../.env.development") });

const devUrl = process.env.DATABASE_URL ?? "";
const testUrl = devUrl.replace(/\/[^/]+$/, "/nexum_test");

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["src/test-utils/global-setup.ts"],
    globalTeardown: ["src/test-utils/global-teardown.ts"],
    alias: {
      "@backend": resolve(__dirname, "./src"),
    },
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testUrl,
      DATABASE_NAME: "nexum_test",
      REDIS_KEY_PREFIX: "nexum-test:",
    },
    pool: "forks",
    fileParallelism: false,
  },
});
