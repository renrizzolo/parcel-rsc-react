import fs from "fs/promises";
import path from "path";
import { PropItem, withCustomConfig } from "react-docgen-typescript";
import { glob } from "tinyglobby";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateProps(
  pagesPattern: string,
  rootDir: string,
  outputPath: string,
  log = console.log
) {
  // TODO - should this be the root tsconfig, the parcel project tsconfig, or the ui library tsconfig?
  // TODO - make this configurable
  const tsconfigPath = path.resolve(rootDir, "./tsconfig.json");

  const docgenParser = withCustomConfig(tsconfigPath, {
    shouldExtractLiteralValuesFromEnum: true,
    savePropValueAsString: true,
    propFilter: (prop) => {
      if (Array.isArray(prop.declarations) && prop.declarations[0]) {
        const declaration = prop.declarations[0];

        if (declaration.fileName.includes("node_modules/@types/react")) {
          if (prop.name !== "ref" && prop.name !== "className") {
            return false;
          }
        }
      }
      return true;
    },
  });

  const files = await glob(pagesPattern, {
    cwd: rootDir,
  });

  if (files.length === 0) {
    log(`No files found for pattern: ${pagesPattern}`);
    return;
  }

  log(`Found ${files.length} files for pattern: ${pagesPattern}`);

  await fs.mkdir(path.resolve(rootDir, outputPath), { recursive: true });

  try {
    for (const file of files) {
      log(`parsing file: : ${file}`);

      const componentName = path.basename(file, path.extname(file));
      const filePath = path.join(rootDir, file);

      const docs = docgenParser.parse(filePath);
      const props = docs[0] ? docs[0].props : {};

      for (const propName in props) {
        const prop = props[propName] as
          | (PropItem & {
              shortPropTypeName: string | null;
            })
          | undefined;

        if (!prop) {
          throw new Error(`No prop found for ${propName} in ${componentName}`);
        }

        if (prop.type && prop.type.name) {
          const { type: shortPropTypeName, detailedType } = getShortPropType(
            propName,
            prop.type.name
          );

          const hasExpandedType = Boolean(detailedType);

          prop.type.name =
            hasExpandedType && prop.type.name.split("|").length > 3
              ? prop.type.name
                  .split("|")
                  .map((line) => `| ${line}\n`)
                  .join("")
              : prop.type.name;

          prop.shortPropTypeName = hasExpandedType ? shortPropTypeName : null;
        }
      }

      const componentJSON = JSON.stringify(
        {
          name: componentName,
          path: file,
          fileName: file.split("/").pop(),
          props,
        },
        null,
        2
      );

      const outputFilePath = path.join(outputPath, `${componentName}.json`);
      await fs.writeFile(outputFilePath, componentJSON + "\n", "utf-8");

      log(`Generated props for ${componentName}`);
    }
  } catch (err) {
    log(`Error generating props: ${err}`);
  }
}

// based on https://github.com/mui/base-ui/blob/master/docs/src/components/ReferenceTable/PropsReferenceAccordion.tsx
function getShortPropType(name: string, type: string) {
  if (/^(on|get)[A-Z].*/.test(name)) {
    return { type: "function", detailedType: true };
  }

  if (type === undefined || type === null) {
    return { type: String(type), detailedType: false };
  }

  if (name === "className") {
    return { type: "string | function", detailedType: true };
  }

  if (name === "render") {
    return { type: "ReactElement | function", detailedType: true };
  }

  if (
    name.endsWith("Ref") ||
    name === "children" ||
    type === "boolean" ||
    type === "string" ||
    type === "number" ||
    type.indexOf(" | ") === -1 ||
    (type.split("|").length < 3 && type.length < 30)
  ) {
    return { type, detailedType: false };
  }

  return { type: "Union", detailedType: true };
}
