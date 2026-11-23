import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const pkgDir = process.cwd();
const isNativePluginPack = Boolean(process.env.PLUGIN_DIR);

function run(cmd, args, cwd) {
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
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

const rootPkg = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "package.json"), "utf-8")
);
const pmSpec = rootPkg.packageManager ?? "pnpm@latest";
const useDirectPnpm = hasPnpm();
const pnpmCmd = useDirectPnpm ? "pnpm" : "npx";
const pnpmPrefix = useDirectPnpm ? [] : ["-y", pmSpec];

if (isNativePluginPack) {
  // Parcel's native-plugin.yml pack job builds JS dist/ only (Rust binaries are
  // shipped separately in the per-platform artifact packages).
  if (!fs.existsSync(path.join(repoRoot, "node_modules"))) {
    run(
      pnpmCmd,
      [...pnpmPrefix, "install", "--frozen-lockfile", "--ignore-scripts"],
      repoRoot
    );
  }
  run(pnpmCmd, [...pnpmPrefix, "exec", "tsdown"], pkgDir);
} else {
  // Git install or local pack: build both the Rust cdylib and JS dist/.
  run(pnpmCmd, [...pnpmPrefix, "run", "build"], pkgDir);
}
