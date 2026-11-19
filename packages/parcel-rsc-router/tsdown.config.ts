import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts", "./src/prerender.tsx"],
  target: "es2018",
  dts: true,
  unbundle: true,
  inputOptions: {
    onLog(level, log, defaultHandler) {
      if (log.code === "MODULE_LEVEL_DIRECTIVE") return;
      defaultHandler(level, log);
    },
  },
  outputOptions: {
    format: "esm",
    dir: "./dist/esm",
  },
});
