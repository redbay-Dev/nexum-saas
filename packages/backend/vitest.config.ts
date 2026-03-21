import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["src/test-utils/global-setup.ts"],
    alias: {
      "@backend": resolve(__dirname, "./src"),
    },
    env: {
      NODE_ENV: "test",
      DATABASE_URL:
        "postgresql://devuser:DevSecure2024!@192.168.50.154:5432/nexum_test",
      DATABASE_NAME: "nexum_test",
      REDIS_KEY_PREFIX: "nexum-test:",
    },
    pool: "forks",
    fileParallelism: false,
  },
});
