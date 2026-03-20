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

    const simpleComponentJsonProps = JSON.parse(
      await fs.readFile(simpleComponentJsonPath, "utf-8")
    ).props;

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

    const anotherComponentJsonProps = JSON.parse(
      await fs.readFile(anotherComponentJsonPath, "utf-8")
    ).props;

    expect(anotherComponentJsonProps).toHaveProperty("enabled");
    expect(anotherComponentJsonProps.enabled.description).toBe(
      "If the component is enabled."
    );
    expect(anotherComponentJsonProps.enabled.type.name).toBe("boolean");

    // Check that it didn't create a json for the tsconfig
    const tsconfigJsonPath = path.join(outputPath, "tsconfig.json");
    await expect(fs.stat(tsconfigJsonPath)).rejects.toThrow();
  });
});
