#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { parseArgs } from "util";
import { generateProps } from "./generate-props.js";

const origin = "@renr/parcel-reporter-docgen";

interface DocgenPluginConfig {
  source?: string;
  output?: string;
  tsconfig?: string;
}

interface PackageConfig {
  [origin]?: DocgenPluginConfig;
}

function loadParcelRcConfig(rootDir: string): DocgenPluginConfig | undefined {
  const parcelRcPath = path.join(rootDir, ".parcelrc");
  if (!fs.existsSync(parcelRcPath)) {
    return undefined;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(parcelRcPath, "utf-8")) as {
      reporters?: Array<
        string | { plugin?: string; config?: DocgenPluginConfig }
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
      tsconfig: { type: "string", short: "t" },
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

  const source =
    (typeof values.source === "string" ? values.source : undefined) ??
    rcConfig?.source ??
    pkgConfig?.[origin]?.source;

  const output =
    (typeof values.output === "string" ? values.output : undefined) ??
    rcConfig?.output ??
    pkgConfig?.[origin]?.output;

  const tsconfig =
    (typeof values.tsconfig === "string" ? values.tsconfig : undefined) ??
    rcConfig?.tsconfig ??
    pkgConfig?.[origin]?.tsconfig;

  if (!source) {
    throw new Error(
      `No "${origin}" source found in .parcelrc or package.json.`
    );
  }

  await generateProps(
    source,
    rootDir,
    output || "docgen",
    (...args) => console.info(args.join(" ")),
    tsconfig
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
