import ThrowableDiagnostic from "@parcel/diagnostic";
import { Reporter } from "@parcel/plugin";
import dedent from "dedent";
import path from "path";
import { pathToFileURL } from "url";
import pacakgeJSON from "../package.json" with { type: "json" };
import { generateRoutes } from "./generate-routes";

const origin = pacakgeJSON.name;

export default new Reporter({
  async report({ event, options, logger }) {
    if (event.type === "buildStart") {
      try {
        const packageJSON = path.join(options.projectRoot, "package.json");

        const fileURL = pathToFileURL(packageJSON).toString();

        const config = (await import(fileURL, {
          with: {
            type: "json",
          },
        }).then((mod) => mod.default)) as {
          targets?: {
            "react-static"?: {
              source: string;
              context: string;
            };
          };
        };

        if (!config.targets?.["react-static"]?.source) {
          throw new ThrowableDiagnostic({
            diagnostic: {
              origin,
              message: dedent`No react-static target found in package.json. 
                NOTE: if you are using a monorepo, you need to run parcel from the package that contains your pages rather than the project root.
                See https://github.com/parcel-bundler/parcel/issues/7206 for a workaround.`,
              // TODO why isn't the hint/documentation showing up in the terminal/error page?
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
          await generateRoutes(
            config.targets["react-static"].source,
            options.projectRoot,
            (log) => logger.info({ origin, message: log })
          );
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
