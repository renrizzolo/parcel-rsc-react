import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const pluginDirs = process.argv.slice(2);
if (pluginDirs.length === 0) {
  console.error("Usage: node scripts/check-native-plugins.mjs <plugin-dir>...");
  process.exit(1);
}

function hasPendingChangesets() {
  const changesetDir = path.resolve(".changeset");
  if (!fs.existsSync(changesetDir)) {
    return false;
  }

  let consumed = new Set();
  const preJsonPath = path.join(changesetDir, "pre.json");
  if (fs.existsSync(preJsonPath)) {
    const pre = JSON.parse(fs.readFileSync(preJsonPath, "utf-8"));
    if (Array.isArray(pre.changesets)) {
      consumed = new Set(pre.changesets);
    }
  }

  for (const entry of fs.readdirSync(changesetDir, { withFileTypes: true })) {
    if (
      !entry.isFile() ||
      !entry.name.endsWith(".md") ||
      entry.name === "README.md"
    ) {
      continue;
    }
    const id = entry.name.slice(0, -3);
    if (!consumed.has(id)) {
      return true;
    }
  }

  return false;
}

function isPublished(name, version) {
  let output;
  try {
    output = execFileSync(
      "npm",
      ["view", name, "versions", "--json", "--prefer-online"],
      { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch (err) {
    const combined = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    if (/\bE404\b/.test(combined)) {
      return false;
    }
    throw err;
  }
  return [JSON.parse(output)].flat().includes(version);
}

function writeOutput(needsPublish, dirs) {
  const summary = needsPublish
    ? `Native plugins needing publish:\n${dirs.map((d) => `  - ${d}`).join("\n")}`
    : "No native plugins need publishing.";
  console.log(summary);

  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    return;
  }
  fs.appendFileSync(outputPath, `needs_publish=${needsPublish}\n`);
  fs.appendFileSync(outputPath, `paths<<EOF\n${dirs.join("\n")}\nEOF\n`);
}

if (hasPendingChangesets()) {
  console.log(
    "Pending changesets detected; skipping native plugin publish until version PR is merged."
  );
  writeOutput(false, []);
  process.exit(0);
}

const toPublish = [];
for (const dir of pluginDirs) {
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(dir, "package.json"), "utf-8")
  );
  const packagesToCheck = [
    pkg.name,
    ...Object.values(pkg.parcel?.artifacts ?? {}),
  ];
  const missing = packagesToCheck.filter(
    (name) => !isPublished(name, pkg.version)
  );
  if (missing.length > 0) {
    console.log(
      `${dir} (${pkg.name}@${pkg.version}) missing on npm: ${missing.join(", ")}`
    );
    toPublish.push(dir);
  } else {
    console.log(
      `${dir} (${pkg.name}@${pkg.version}) and all platform artifacts are already published.`
    );
  }
}

writeOutput(toPublish.length > 0, toPublish);
