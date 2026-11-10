import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/bin.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  bundle: true,
  noExternal: ["@brightdata/enrich-core"],
  banner: {
    js: [
      "#!/usr/bin/env node",
      'import{createRequire}from"module";const require=createRequire(import.meta.url);',
    ].join("\n"),
  },
  clean: true,
  minify: true,
  sourcemap: false,
});
