import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/shared/helpers.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
});
