import fs from "fs/promises";
import path from "path";
import { PropItem, withCustomConfig } from "react-docgen-typescript";
import { glob } from "tinyglobby";
import ts from "typescript";
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

        const fileDocs = docsByFilePath.get(path.resolve(absPath)) || [];

        // Check if the component was composed using Object.assign(Base, { SubName: Target, ... })
        const sourceText = await fs.readFile(absPath, "utf-8");
        const assignedInfo = getAssignedInfo(sourceText, componentName);

        // 1. Identify primary component doc matching componentName or assigned base
        const primaryDoc =
          fileDocs.find((d) => d.displayName === componentName) ||
          (assignedInfo.baseIdentifier
            ? fileDocs.find((d) => d.displayName === assignedInfo.baseIdentifier)
            : undefined) ||
          fileDocs.find((d) => Object.keys(d.props).length > 0) ||
          fileDocs[0];

        // If primaryDoc was created by Object.assign and lost props, recover from base
        let primaryProps = primaryDoc ? primaryDoc.props : {};
        if (
          assignedInfo.baseIdentifier &&
          primaryDoc &&
          primaryDoc.displayName === componentName
        ) {
          const baseDoc = fileDocs.find(
            (d) => d.displayName === assignedInfo.baseIdentifier
          );
          if (
            baseDoc &&
            Object.keys(baseDoc.props).length > Object.keys(primaryProps).length
          ) {
            primaryProps = baseDoc.props;
          }
        }

        const formattedPrimaryProps = formatProps(primaryProps);

        // 2. Identify subcomponents
        const subcomponents: Record<
          string,
          {
            name: string;
            description?: string;
            props: ReturnType<typeof formatProps>;
          }
        > = {};

        // a) Handle subcomponents explicitly assigned via Object.assign(Base, { SubName: Target })
        for (const [subName, targetName] of assignedInfo.subcomponentsMap) {
          const subDoc = fileDocs.find(
            (d) =>
              d.displayName === targetName ||
              d.displayName === `${componentName}.${subName}`
          );
          if (subDoc) {
            subcomponents[subName] = {
              name: `${componentName}.${subName}`,
              description: subDoc.description || undefined,
              props: formatProps(subDoc.props),
            };
          }
        }

        // b) Handle subcomponents matching standard React dot notation or component prefix
        for (const doc of fileDocs) {
          if (doc === primaryDoc) continue;
          if (
            assignedInfo.baseIdentifier &&
            doc.displayName === assignedInfo.baseIdentifier
          ) {
            continue;
          }

          let subName: string | undefined;
          if (doc.displayName.startsWith(`${componentName}.`)) {
            subName = doc.displayName.slice(componentName.length + 1);
          } else if (doc.displayName.startsWith(componentName)) {
            subName = doc.displayName.slice(componentName.length);
          }

          if (subName) {
            const existing = subcomponents[subName];
            if (
              existing &&
              Object.keys(existing.props).length >=
                Object.keys(doc.props).length
            ) {
              continue;
            }

            subcomponents[subName] = {
              name: `${componentName}.${subName}`,
              description: doc.description || undefined,
              props: formatProps(doc.props),
            };
          }
        }

        const componentJSON = JSON.stringify(
          {
            name: componentName,
            description: primaryDoc?.description || undefined,
            path: relFile,
            fileName: relFile.split("/").pop(),
            props: formattedPrimaryProps,
            subcomponents:
              Object.keys(subcomponents).length > 0 ? subcomponents : undefined,
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

function formatProps(rawProps: Record<string, PropItem>) {
  const props: Record<
    string,
    PropItem & {
      shortPropTypeName: string | null;
    }
  > = {};

  for (const propName in rawProps) {
    const rawProp = rawProps[propName];
    if (!rawProp) {
      continue;
    }

    const prop = { ...rawProp } as PropItem & {
      shortPropTypeName: string | null;
    };

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

    props[propName] = prop;
  }

  return props;
}

function getAssignedInfo(sourceText: string, compName: string) {
  const sourceFile = ts.createSourceFile(
    "temp.tsx",
    sourceText,
    ts.ScriptTarget.Latest,
    true
  );
  let baseIdentifier: string | null = null;
  const subcomponentsMap = new Map<string, string>();

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          decl.name.getText(sourceFile) === compName &&
          decl.initializer &&
          ts.isCallExpression(decl.initializer)
        ) {
          const call = decl.initializer;
          const exprText = call.expression.getText(sourceFile);
          if (
            (exprText === "Object.assign" || exprText.endsWith(".assign")) &&
            call.arguments.length > 0
          ) {
            const firstArg = call.arguments[0];
            if (firstArg) {
              baseIdentifier = firstArg.getText(sourceFile);
            }
            if (
              call.arguments.length > 1 &&
              ts.isObjectLiteralExpression(call.arguments[1]!)
            ) {
              for (const prop of call.arguments[1]!.properties) {
                if (ts.isPropertyAssignment(prop)) {
                  subcomponentsMap.set(
                    prop.name.getText(sourceFile),
                    prop.initializer.getText(sourceFile)
                  );
                } else if (ts.isShorthandPropertyAssignment(prop)) {
                  subcomponentsMap.set(
                    prop.name.getText(sourceFile),
                    prop.name.getText(sourceFile)
                  );
                }
              }
            }
          }
        }
      }
    }
  });

  return { baseIdentifier, subcomponentsMap };
}

