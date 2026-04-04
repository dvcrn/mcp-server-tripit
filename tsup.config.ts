import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "node",
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  outDir: "dist",
  banner: {
    js: "#!/usr/bin/env node",
  },
});
