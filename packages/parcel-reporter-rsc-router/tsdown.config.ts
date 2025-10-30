import { defineConfig } from "tsdown";

const baseOptions = {
  entry: ["./src/index.ts"],
  target: "es2018",
};

export default defineConfig([
  {
    ...baseOptions,
    outputOptions: {
      format: "cjs",
      dir: "./dist/cjs",
      chunkFileNames: "[name]-[hash].cjs",
      entryFileNames: "[name].cjs",
    },
  },
  {
    ...baseOptions,
    dts: true,
    outputOptions: {
      format: "esm",
      dir: "./dist/esm",
    },
  },
]);
