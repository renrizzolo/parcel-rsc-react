import ThrowableDiagnostic from "@parcel/diagnostic";
import { Reporter } from "@parcel/plugin";
import dedent from "dedent";
import fs from "fs";
import path from "path";
import { generateRoutes } from "./generate-routes";

const origin = "@renr/parcel-reporter-rsc-router";

interface TargetConfig {
  source?: string;
  context?: string;
}

interface PackageConfig {
  targets?: {
    "react-static"?: TargetConfig;
  };
  [origin]?: {
    output?: string;
  };
}

async function loadPackageJson(
  filePath: string
): Promise<PackageConfig | null> {
  try {
    if (fs.existsSync(filePath)) {
      const content = await fs.promises.readFile(filePath, "utf-8");
      return JSON.parse(content) as PackageConfig;
    }
  } catch {
    // ignore parse error
  }
  return null;
}

export default new Reporter({
  async report({ event, options, logger }) {
    if (event.type === "buildStart") {
      try {
        const cwdPackageJSON = path.join(process.cwd(), "package.json");
        const projectPackageJSON = path.join(
          options.projectRoot,
          "package.json"
        );

        const cwdConfig = await loadPackageJson(cwdPackageJSON);
        let config: PackageConfig | null = null;
        let packageJSON = cwdPackageJSON;
        let rootDir = process.cwd();

        if (cwdConfig?.targets?.["react-static"]?.source) {
          config = cwdConfig;
          packageJSON = cwdPackageJSON;
          rootDir = process.cwd();
        } else {
          const projectConfig = await loadPackageJson(projectPackageJSON);
          if (projectConfig?.targets?.["react-static"]?.source) {
            config = projectConfig;
            packageJSON = projectPackageJSON;
            rootDir = options.projectRoot;
          } else {
            config = cwdConfig || projectConfig || {};
            packageJSON = cwdConfig ? cwdPackageJSON : projectPackageJSON;
            rootDir = cwdConfig ? process.cwd() : options.projectRoot;
          }
        }

        const source = config.targets?.["react-static"]?.source;
        const output = config[origin]?.output;

        if (!source) {
          throw new ThrowableDiagnostic({
            diagnostic: {
              origin,
              message: dedent`No react-static target found in package.json. 
                NOTE: if you are using a monorepo, you need to run parcel from the package that contains your pages rather than the project root.
                See https://github.com/parcel-bundler/parcel/issues/7206 for a workaround.`,
              hints: [
                "Add a react-static target to your package.json with a source e.g `src/pages/**/*.{tsx,mdx}`.",
              ],
              documentationURL:
                "https://parceljs.org/recipes/rsc/#static-rendering",
              codeFrames: [
                {
                  codeHighlights: [
                    {
                      start: { line: 3, column: 2 },
                      end: { line: 7, column: 44 },
                      message:
                        "Add a react-static target source to generate routes for your pages.",
                    },
                  ],
                  language: "json",
                  filePath: packageJSON,
                  code: dedent`{
                        "targets": {
                          "react-static": {
                            "source": "src/pages/**/*.{tsx,mdx}",
                          }
                        }
                      } `,
                },
              ],
            },
          });
        }
        try {
          await generateRoutes({
            pagesPattern: source,
            rootDir,
            outputPath: output,
            log: (log) => logger.info({ origin, message: log }),
          });
        } catch (error) {
          throwError(error as Error);
        }
      } catch (error) {
        throwError(error as Error);
      }
      return;
    }
  },
});

function throwError(error: Error) {
  throw new ThrowableDiagnostic({
    diagnostic: {
      origin,
      message: error.message,
      stack: error.stack,
    },
  });
}
