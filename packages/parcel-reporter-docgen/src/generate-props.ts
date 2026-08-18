import fs from "fs/promises";
import path from "path";
import { PropItem, withCustomConfig } from "react-docgen-typescript";
import { glob } from "tinyglobby";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// cache for watch mode across buildStart events
const fileMtimeCache = new Map<string, number>();

export async function generateProps(
  pagesPattern: string,
  rootDir: string,
  outputPath: string,
  log = console.log
) {
  const files = await glob(pagesPattern, {
    cwd: rootDir,
  });

  if (files.length === 0) {
    log(`No files found for pattern: ${pagesPattern}`);
    return;
  }

  const resolvedOutputPath = path.resolve(rootDir, outputPath);
  await fs.mkdir(resolvedOutputPath, { recursive: true });

  const filesToProcess: {
    relFile: string;
    absPath: string;
    componentName: string;
  }[] = [];

  for (const file of files) {
    const filePath = path.resolve(rootDir, file);
    const componentName = path.basename(file, path.extname(file));
    const outputFilePath = path.join(
      resolvedOutputPath,
      `${componentName}.json`
    );

    try {
      const sourceStat = await fs.stat(filePath);
      const cachedMtime = fileMtimeCache.get(filePath);

      let isUpToDate = false;
      try {
        const outStat = await fs.stat(outputFilePath);
        if (
          (cachedMtime !== undefined && cachedMtime === sourceStat.mtimeMs) ||
          outStat.mtimeMs >= sourceStat.mtimeMs
        ) {
          isUpToDate = true;
          fileMtimeCache.set(filePath, sourceStat.mtimeMs);
        }
      } catch {
        // output file does not exist
      }

      if (isUpToDate) {
        continue;
      }

      filesToProcess.push({
        relFile: file,
        absPath: filePath,
        componentName,
      });
      fileMtimeCache.set(filePath, sourceStat.mtimeMs);
    } catch {
      // source file not accessible
    }
  }

  if (filesToProcess.length === 0) {
    return;
  }

  log(
    `Found ${filesToProcess.length} changed file(s) for pattern: ${pagesPattern}`
  );

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

  try {
    const absPaths = filesToProcess.map((f) => f.absPath);
    const allDocs = docgenParser.parse(absPaths);

    const docsByFilePath = new Map<string, typeof allDocs>();
    for (const doc of allDocs) {
      if (doc.filePath) {
        const key = path.resolve(doc.filePath);
        const list = docsByFilePath.get(key) || [];
        list.push(doc);
        docsByFilePath.set(key, list);
      }
    }

    await Promise.all(
      filesToProcess.map(async ({ relFile, absPath, componentName }) => {
        log(`parsing file: : ${relFile}`);

        const fileDocs = docsByFilePath.get(path.resolve(absPath));
        const props = fileDocs && fileDocs[0] ? fileDocs[0].props : {};

        for (const propName in props) {
          const prop = props[propName] as
            | (PropItem & {
                shortPropTypeName: string | null;
              })
            | undefined;

          if (!prop) {
            throw new Error(
              `No prop found for ${propName} in ${componentName}`
            );
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
            path: relFile,
            fileName: relFile.split("/").pop(),
            props,
          },
          null,
          2
        );

        const outputFilePath = path.join(
          resolvedOutputPath,
          `${componentName}.json`
        );
        await fs.writeFile(outputFilePath, componentJSON + "\n", "utf-8");

        log(`Generated props for ${componentName}`);
      })
    );
  } catch (err) {
    log(`Error generating props: ${(err as Error).message}`);
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
