import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateProps } from "./generate-props.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("generateProps", () => {
  const exampleDir = path.resolve(__dirname, "../example");
  const rootDir = exampleDir;
  const outputPath = path.join(exampleDir, "dist");

  beforeAll(async () => {
    // Clean up previous runs
    await fs.rm(outputPath, { recursive: true, force: true });
  });

  afterAll(async () => {
    await fs.rm(outputPath, { recursive: true, force: true });
  });

  it("should generate props for components matching the glob pattern", async () => {
    await generateProps("src/**/*.tsx", rootDir, outputPath);

    // Check if JSON file for SimpleComponent was created
    const simpleComponentJsonPath = path.join(
      outputPath,
      "SimpleComponent.json"
    );

    const stats1 = await fs.stat(simpleComponentJsonPath);
    expect(stats1.isFile()).toBe(true);

    const simpleComponentJson = JSON.parse(
      await fs.readFile(simpleComponentJsonPath, "utf-8")
    );
    const simpleComponentJsonProps = simpleComponentJson.props;

    expect(simpleComponentJson.name).toBe("SimpleComponent");
    expect(simpleComponentJson.subcomponents).toBeUndefined();
    expect(simpleComponentJsonProps).toHaveProperty("name");
    expect(simpleComponentJsonProps.name.description).toBe(
      "A description for the name prop."
    );
    expect(simpleComponentJsonProps.name.type.name).toBe("string");

    // Check if JSON file for AnotherComponent was created
    const anotherComponentJsonPath = path.join(
      outputPath,
      "AnotherComponent.json"
    );

    const stats2 = await fs.stat(anotherComponentJsonPath);
    expect(stats2.isFile()).toBe(true);

    const anotherComponentJson = JSON.parse(
      await fs.readFile(anotherComponentJsonPath, "utf-8")
    );
    const anotherComponentJsonProps = anotherComponentJson.props;

    expect(anotherComponentJson.name).toBe("AnotherComponent");
    expect(anotherComponentJson.subcomponents).toBeUndefined();
    expect(anotherComponentJsonProps).toHaveProperty("enabled");
    expect(anotherComponentJsonProps.enabled.description).toBe(
      "If the component is enabled."
    );
    expect(anotherComponentJsonProps.enabled.type.name).toBe("boolean");

    // Check CompoundComponent with static property assignment
    const compoundJsonPath = path.join(outputPath, "CompoundComponent.json");
    const compoundJson = JSON.parse(
      await fs.readFile(compoundJsonPath, "utf-8")
    );
    expect(compoundJson.name).toBe("CompoundComponent");
    expect(compoundJson.props).toHaveProperty("label");
    expect(compoundJson.subcomponents).toBeDefined();
    expect(Object.keys(compoundJson.subcomponents)).toEqual(["Sub"]);
    expect(compoundJson.subcomponents.Sub.name).toBe("CompoundComponent.Sub");
    expect(compoundJson.subcomponents.Sub.props).toHaveProperty("subProp");
    expect(compoundJson.subcomponents.Sub.props.subProp.type.name).toBe(
      "number"
    );
    // Check AssignedCompound with Object.assign pattern
    const assignedJsonPath = path.join(outputPath, "AssignedCompound.json");
    const assignedJson = JSON.parse(
      await fs.readFile(assignedJsonPath, "utf-8")
    );
    expect(assignedJson.name).toBe("AssignedCompound");
    expect(assignedJson.props).toHaveProperty("height");
    expect(assignedJson.subcomponents).toBeDefined();
    expect(Object.keys(assignedJson.subcomponents)).toEqual(["Main"]);
    expect(assignedJson.subcomponents.Main.name).toBe("AssignedCompound.Main");
    expect(assignedJson.subcomponents.Main.props).toHaveProperty("as");
    expect(assignedJson.subcomponents.Main.props.as.type.name).toBe(
      "string | undefined"
    );
    expect(assignedJson.fileName).toBe("AssignedCompound.tsx");
    expect(assignedJson.path).toBe("src/AssignedCompound.tsx");

    // Check ExportedCompound with named export pattern (Dialog-style)
    const exportedJsonPath = path.join(outputPath, "ExportedCompound.json");
    const exportedJson = JSON.parse(
      await fs.readFile(exportedJsonPath, "utf-8")
    );
    expect(exportedJson.name).toBe("ExportedCompound.Root");
    expect(exportedJson.props).toHaveProperty("open");
    expect(exportedJson.subcomponents).toBeDefined();
    expect(Object.keys(exportedJson.subcomponents)).toEqual(["Trigger"]);
    expect(exportedJson.subcomponents.Trigger.name).toBe(
      "ExportedCompound.Trigger"
    );
    expect(exportedJson.subcomponents.Trigger.props).toHaveProperty("onClick");

    // Check that it didn't create a json for the tsconfig
    const tsconfigJsonPath = path.join(outputPath, "tsconfig.json");
    await expect(fs.stat(tsconfigJsonPath)).rejects.toThrow();
  });

  it("should support a custom tsconfig path", async () => {
    const customOutputPath = path.join(exampleDir, "dist-custom");
    await fs.mkdir(customOutputPath, { recursive: true });

    try {
      await generateProps(
        "src/SimpleComponent.tsx",
        rootDir,
        customOutputPath,
        () => {},
        "./tsconfig.json"
      );

      const simpleComponentJsonPath = path.join(
        customOutputPath,
        "SimpleComponent.json"
      );
      const stat = await fs.stat(simpleComponentJsonPath);
      expect(stat.isFile()).toBe(true);
    } finally {
      await fs.rm(customOutputPath, { recursive: true, force: true });
    }
  });
});
