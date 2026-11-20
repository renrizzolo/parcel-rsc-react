#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { parseArgs } from "util";
import {
  generateRoutes,
  type ReporterPluginConfig,
} from "./generate-routes.js";

const origin = "@renr/parcel-plugin-rsc-router";

interface PackageConfig {
  source?: string | string[];
  [origin]?: ReporterPluginConfig;
}

function isRoutesEntry(source: string): boolean {
  return (
    source === "routes.ts" ||
    source.endsWith("/routes.ts") ||
    source.endsWith("\\routes.ts")
  );
}

function loadParcelRcConfig(rootDir: string): ReporterPluginConfig | undefined {
  const parcelRcPath = path.join(rootDir, ".parcelrc");
  if (!fs.existsSync(parcelRcPath)) {
    return undefined;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(parcelRcPath, "utf-8")) as {
      reporters?: Array<
        string | { plugin?: string; config?: ReporterPluginConfig }
      >;
    };
    if (Array.isArray(raw.reporters)) {
      for (const entry of raw.reporters) {
        if (
          typeof entry === "object" &&
          entry !== null &&
          entry.plugin === origin &&
          entry.config
        ) {
          return entry.config;
        }
      }
    }
  } catch {
    // ignore parse errors
  }
  return undefined;
}

function loadPackageConfig(rootDir: string): PackageConfig | undefined {
  const pkgPath = path.join(rootDir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return undefined;
  }
  try {
    return JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as PackageConfig;
  } catch {
    return undefined;
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      source: { type: "string", short: "s" },
      output: { type: "string", short: "o" },
      root: { type: "string", short: "r" },
    },
    strict: false,
  });

  const rootDir =
    typeof values.root === "string"
      ? path.resolve(process.cwd(), values.root)
      : process.cwd();

  const rcConfig = loadParcelRcConfig(rootDir);
  const pkgConfig = loadPackageConfig(rootDir);

  const fallbackPkgSource =
    typeof pkgConfig?.source === "string" && !isRoutesEntry(pkgConfig.source)
      ? pkgConfig.source
      : undefined;

  const source =
    (typeof values.source === "string" ? values.source : undefined) ??
    rcConfig?.source ??
    pkgConfig?.[origin]?.source ??
    fallbackPkgSource;

  const output =
    (typeof values.output === "string" ? values.output : undefined) ??
    rcConfig?.output ??
    pkgConfig?.[origin]?.output;

  if (!source) {
    throw new Error(
      `No route source found in .parcelrc or package.json under "${origin}".`
    );
  }

  await generateRoutes({
    pagesPattern: source,
    rootDir,
    outputPath: output,
    log: console.info,
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
