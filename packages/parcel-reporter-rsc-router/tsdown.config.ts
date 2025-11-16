import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  target: "es2018",
  dts: true,
  unbundle: true,
  outputOptions: {
    format: "esm",
    dir: "./dist/esm",
  },
});
