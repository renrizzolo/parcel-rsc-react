import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import reporter from "./index.js";
import { clearRouteCaches } from "./generate-routes.js";

function getReportFn(rep: any) {
  if (typeof rep.report === "function") {
    return rep.report.bind(rep);
  }
  const symbols = Object.getOwnPropertySymbols(rep);
  for (const sym of symbols) {
    if (rep[sym]?.report) {
      return rep[sym].report.bind(rep);
    }
  }
  throw new Error("Could not find report function on reporter");
}

describe("reporter index", () => {
  const originalCwd = process.cwd();
  let tmpRoot: string;
  let monorepoRoot: string;
  let appDir: string;

  beforeEach(() => {
    clearRouteCaches();
    tmpRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "parcel-reporter-rsc-router-index-test-")
    );
    monorepoRoot = path.join(tmpRoot, "monorepo");
    appDir = path.join(monorepoRoot, "apps", "my-app");
    fs.mkdirSync(appDir, { recursive: true });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    clearRouteCaches();
  });

  it("reads react-static target from cwd package.json first in monorepos", async () => {
    // Monorepo root package.json has NO react-static target
    fs.writeFileSync(
      path.join(monorepoRoot, "package.json"),
      JSON.stringify({
        name: "monorepo-root",
        private: true,
      })
    );

    // App package.json in cwd HAS react-static target
    const pagesDir = path.join(appDir, "src", "pages");
    fs.mkdirSync(pagesDir, { recursive: true });
    fs.writeFileSync(
      path.join(pagesDir, "index.tsx"),
      "export default () => null;"
    );

    fs.writeFileSync(
      path.join(appDir, "package.json"),
      JSON.stringify({
        name: "my-app",
        targets: {
          "react-static": {
            source: "src/pages/**/*.{tsx,ts}",
          },
        },
        "@renr/parcel-reporter-rsc-router": {
          output: "src/routes.ts",
        },
      })
    );

    process.chdir(appDir);

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      verbose: vi.fn(),
    };

    // options.projectRoot points to monorepo root (like parcel does)
    await getReportFn(reporter)({
      event: { type: "buildStart" } as any,
      options: { projectRoot: monorepoRoot } as any,
      logger: logger as any,
    });

    const expectedRoutesPath = path.join(appDir, "src", "routes.ts");
    expect(fs.existsSync(expectedRoutesPath)).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "@renr/parcel-reporter-rsc-router",
        message: expect.stringContaining("Routes generated"),
      })
    );
  });

  it("falls back to options.projectRoot if cwd package.json does not have react-static target", async () => {
    const pagesDir = path.join(monorepoRoot, "src", "pages");
    fs.mkdirSync(pagesDir, { recursive: true });
    fs.writeFileSync(
      path.join(pagesDir, "index.tsx"),
      "export default () => null;"
    );

    fs.writeFileSync(
      path.join(monorepoRoot, "package.json"),
      JSON.stringify({
        name: "single-project",
        targets: {
          "react-static": {
            source: "src/pages/**/*.{tsx,ts}",
          },
        },
      })
    );

    // Empty cwd dir without react-static in package.json
    process.chdir(appDir);
    fs.writeFileSync(
      path.join(appDir, "package.json"),
      JSON.stringify({ name: "sub-package" })
    );

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      verbose: vi.fn(),
    };

    await getReportFn(reporter)({
      event: { type: "buildStart" } as any,
      options: { projectRoot: monorepoRoot } as any,
      logger: logger as any,
    });

    const expectedRoutesPath = path.join(monorepoRoot, "routes.ts");
    expect(fs.existsSync(expectedRoutesPath)).toBe(true);
  });

  it("throws diagnostic when neither cwd nor projectRoot has react-static target", async () => {
    fs.writeFileSync(
      path.join(monorepoRoot, "package.json"),
      JSON.stringify({ name: "root" })
    );
    process.chdir(appDir);

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      verbose: vi.fn(),
    };

    await expect(
      getReportFn(reporter)({
        event: { type: "buildStart" } as any,
        options: { projectRoot: monorepoRoot } as any,
        logger: logger as any,
      })
    ).rejects.toThrow(/No react-static target found in package\.json/);
  });
});
