import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const cwd = process.cwd();
const cargoTomlPath = path.join(cwd, "Cargo.toml");
const cargoLockPath = path.join(cwd, "Cargo.lock");
const libRsPath = path.join(cwd, "src", "lib.rs");

const cargoToml = fs.readFileSync(cargoTomlPath, "utf-8");
const nameMatch = cargoToml.match(/^name\s*=\s*"([^"]+)"/m);
const crateName = (nameMatch ? nameMatch[1] : path.basename(cwd)).replace(
  /-/g,
  "_"
);

const releaseDir = path.join(cwd, "target", "release");
const libCandidates =
  process.platform === "win32"
    ? [`${crateName}.dll`]
    : process.platform === "darwin"
      ? [`lib${crateName}.dylib`]
      : [`lib${crateName}.so`];

const existingLib = libCandidates
  .map((file) => path.join(releaseDir, file))
  .find((file) => fs.existsSync(file));

const isTest = process.argv.includes("--test");
const cargoBinDir = path.join(os.homedir(), ".cargo", "bin");
const env = {
  ...process.env,
  PATH: `${cargoBinDir}${path.delimiter}${process.env.PATH ?? process.env.Path ?? ""}`,
};

if (isTest) {
  const testResult = spawnSync("cargo", ["test", "--offline"], {
    cwd,
    env,
    stdio: "inherit",
  });
  process.exit(testResult.status ?? 1);
}

if (existingLib) {
  const libStat = fs.statSync(existingLib);
  const srcStat = fs.statSync(libRsPath);
  const tomlStat = fs.statSync(cargoTomlPath);
  const lockMtimeMs = fs.existsSync(cargoLockPath)
    ? fs.statSync(cargoLockPath).mtimeMs
    : 0;
  if (
    libStat.mtimeMs >= srcStat.mtimeMs &&
    libStat.mtimeMs >= tomlStat.mtimeMs &&
    libStat.mtimeMs >= lockMtimeMs
  ) {
    process.exit(0);
  }

  // On Windows, a running `parcel serve` process locks the loaded .dll against deletion/overwrite,
  // but NTFS allows renaming a loaded .dll so cargo can write the new binary in its place.
  if (process.platform === "win32" && fs.existsSync(releaseDir)) {
    for (const entry of fs.readdirSync(releaseDir)) {
      if (entry.endsWith(".old")) {
        try {
          fs.unlinkSync(path.join(releaseDir, entry));
        } catch {
          // Still locked by a running process
        }
      }
    }
    const backupPath = `${existingLib}.${Date.now()}.old`;
    try {
      fs.renameSync(existingLib, backupPath);
      try {
        fs.unlinkSync(backupPath);
      } catch {
        // Still locked by a running process; will be cleaned up on a future build
      }
    } catch {
      // Ignore if rename fails
    }
  }
}

const result = spawnSync("cargo", ["build", "--release", "--offline"], {
  cwd,
  env,
  stdio: "inherit",
});

if (result.status !== 0) {
  // Retry without --offline if crates are not cached locally yet
  const fallback = spawnSync("cargo", ["build", "--release"], {
    cwd,
    env,
    stdio: "inherit",
  });
  process.exit(fallback.status ?? 1);
}
