import ThrowableDiagnostic from "@parcel/diagnostic";
import { Reporter } from "@parcel/plugin";
import path from "path";
import { pathToFileURL } from "url";
import { generateProps } from "./generate-props.js";
import packageJSON from "../package.json" with { type: "json" };
import dedent from "dedent";

const origin = packageJSON.name;

export default new Reporter({
  async report({ event, options, logger }) {
    if (event.type === "buildStart") {
      try {
        const projectPackageJSON = path.join(
          options.projectRoot,
          "package.json"
        );

        const fileURL = pathToFileURL(projectPackageJSON).toString();

        const config = (await import(fileURL, {
          with: {
            type: "json",
          },
        }).then((mod) => mod.default)) as {
          [origin]?: {
            source: string;
            output?: string;
            tsconfig?: string;
          };
        };

        const source = config[origin]?.source;
        const output = config[origin]?.output;
        const tsconfig = config[origin]?.tsconfig;

        if (!source) {
          throw new ThrowableDiagnostic({
            diagnostic: {
              origin,
              message: dedent`No "@renr/parcel-reporter-docgen" source found in package.json. 
                NOTE: if you are using a monorepo, you need to run parcel from the package that contains your pages rather than the project root.
                See https://github.com/parcel-bundler/parcel/issues/7206 for a workaround.`,
              hints: [
                'Add a "@renr/parcel-reporter-docgen" source to your package.json with a source e.g `../packages/ui/src/**/*.{ts,tsx}`.',
              ],

              codeFrames: [
                {
                  codeHighlights: [
                    {
                      start: { line: 3, column: 2 },
                      end: { line: 7, column: 44 },
                      message:
                        'Add a "@renr/parcel-reporter-docgen" source to generate docs for your UI components.',
                    },
                  ],
                  language: "json",
                  filePath: projectPackageJSON,
                  code: dedent`{
                        "@renr/parcel-reporter-docgen": {
                          "source": "../packages/ui/src/**/*.{ts,tsx}",
                          "output": "docs/components"
                        }
                      } `,
                },
              ],
            },
          });
        }
        try {
          await generateProps(
            source,
            options.projectRoot,
            output || "docgen",
            (...args) => logger.info({ origin, message: args.join(" ") }),
            tsconfig
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
