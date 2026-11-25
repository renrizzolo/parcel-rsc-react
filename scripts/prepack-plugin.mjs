import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const pkgDir = process.cwd();
const isNativePluginPack = Boolean(process.env.PLUGIN_DIR);

// Route child stdout to stderr so `npm pack --json` stdout stays valid JSON.
function run(cmd, args, cwd) {
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: ["ignore", process.stderr, process.stderr],
    shell: process.platform === "win32",
  });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

function hasPnpm() {
  const res = spawnSync("pnpm", ["--version"], {
    cwd: repoRoot,
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  return res.status === 0;
}

function loadWorkspaceVersions(rootDir) {
  const versions = new Map();
  for (const relPath of fs.globSync("packages/**/package.json", {
    cwd: rootDir,
    exclude: (p) => p.includes("node_modules") || p.includes("target"),
  })) {
    try {
      const parsed = JSON.parse(
        fs.readFileSync(path.join(rootDir, relPath), "utf-8")
      );
      if (
        typeof parsed.name === "string" &&
        typeof parsed.version === "string"
      ) {
        versions.set(parsed.name, parsed.version);
      }
    } catch {
      // Ignore unreadable package.json files
    }
  }
  return versions;
}

function resolveWorkspaceProtocol(pkgJsonText, rootDir) {
  const pkg = JSON.parse(pkgJsonText);
  const versions = loadWorkspaceVersions(rootDir);
  const sections = ["dependencies", "peerDependencies", "optionalDependencies"];

  for (const section of sections) {
    const deps = pkg[section];
    if (!deps || typeof deps !== "object") continue;
    for (const [name, spec] of Object.entries(deps)) {
      if (typeof spec !== "string" || !spec.startsWith("workspace:")) continue;
      const version = versions.get(name);
      if (!version) {
        throw new Error(
          `Could not resolve workspace version for "${name}" (${spec})`
        );
      }
      const rest = spec.slice("workspace:".length);
      if (rest === "*") {
        deps[name] = version;
      } else if (rest === "^" || rest === "~") {
        deps[name] = `${rest}${version}`;
      } else {
        deps[name] = rest;
      }
    }
  }

  return `${JSON.stringify(pkg, null, 2)}\n`;
}

const rootPkg = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "package.json"), "utf-8")
);
const pmSpec = rootPkg.packageManager ?? "pnpm@latest";
const useDirectPnpm = hasPnpm();
const pnpmCmd = useDirectPnpm ? "pnpm" : "npx";
const pnpmPrefix = useDirectPnpm ? [] : ["-y", pmSpec];

if (isNativePluginPack) {
  // Parcel's native-plugin.yml pack job temporarily edits package.json to add
  // unpublished platform optionalDependencies before running `npm pack`.
  // Temporarily restore the checked-in package.json so `pnpm install --frozen-lockfile`
  // succeeds, build JS dist/ only (Rust binaries live in platform artifact packages),
  // then write back the edited package.json with `workspace:*` specifiers resolved
  // (since `npm pack` does not rewrite pnpm's workspace protocol).
  const pkgJsonPath = path.join(pkgDir, "package.json");
  const packedPkgJson = fs.readFileSync(pkgJsonPath, "utf-8");
  const resolvedPackedPkgJson = resolveWorkspaceProtocol(
    packedPkgJson,
    repoRoot
  );
  try {
    if (!fs.existsSync(path.join(repoRoot, "node_modules"))) {
      run("git", ["checkout", "--", pkgJsonPath], repoRoot);
      run(
        pnpmCmd,
        [...pnpmPrefix, "install", "--frozen-lockfile", "--ignore-scripts"],
        repoRoot
      );
    }
    run(pnpmCmd, [...pnpmPrefix, "exec", "tsdown"], pkgDir);
  } finally {
    fs.writeFileSync(pkgJsonPath, resolvedPackedPkgJson);
  }
} else {
  // Git install or local pack: build both the Rust cdylib and JS dist/.
  run(pnpmCmd, [...pnpmPrefix, "run", "build"], pkgDir);
}
