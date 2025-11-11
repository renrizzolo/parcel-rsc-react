import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["packages/**/*.test.ts", "packages/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
