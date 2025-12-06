import ThrowableDiagnostic from "@parcel/diagnostic";
import { Reporter } from "@parcel/plugin";
import path from "path";
import { pathToFileURL } from "url";
import { generateProps } from "./generate-props.js";
import pacakgeJSON from "../package.json" with { type: "json" };
import dedent from "dedent";

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
          [origin]?: {
            source: string;
            output?: string;
          };
        };

        const source = config[origin]?.source;
        const output = config[origin]?.output;

        if (!source) {
          // @ts-expect-error compiled verison needs to use default
          throw new ThrowableDiagnostic.default({
            diagnostic: {
              origin,
              message: dedent`No "@renr/parcel-reporter-docgen" source found in package.json. 
                NOTE: if you are using a monorepo, you need to run parcel from the package that contains your pages rather than the project root.
                See https://github.com/parcel-bundler/parcel/issues/7206 for a workaround.`,
              // TODO why isn't the hint/documentation showing up in the terminal/error page?
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
                  filePath: packageJSON,
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
  // @ts-expect-error compiled verison needs to use default
  throw new ThrowableDiagnostic.default({
    diagnostic: {
      origin,
      message: error.message,
      stack: error.stack,
    },
  });
}
