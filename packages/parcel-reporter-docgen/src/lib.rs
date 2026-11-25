use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use parcel_plugin::{
  CodeFrame, CodeHighlight, Config, Diagnostic, LogLevel, Options, Plugin, register_plugin,
};
use serde::Deserialize;

const PACKAGE_NAME: &str = "@renr/parcel-reporter-docgen";

#[derive(Debug, Default, Clone, Deserialize, PartialEq, Eq)]
struct DocgenConfig {
  source: Option<String>,
  output: Option<String>,
  tsconfig: Option<String>,
}

#[derive(Debug, Default, Clone, Deserialize, PartialEq, Eq)]
struct PackageJson {
  #[serde(rename = "@renr/parcel-reporter-docgen")]
  plugin_config: Option<DocgenConfig>,
}

#[derive(Debug, Clone)]
struct ResolvedDocgenConfig {
  root_dir: PathBuf,
  pkg_path: PathBuf,
  source: Option<String>,
  output: Option<String>,
  tsconfig: Option<String>,
}

pub struct DocgenReporter {
  config: ResolvedDocgenConfig,
}

impl DocgenReporter {
  fn resolve_config(config: &Config, options: &Options) -> Result<ResolvedDocgenConfig, Diagnostic> {
    let inline = if config.bytes().is_empty() {
      DocgenConfig::default()
    } else {
      serde_json::from_slice::<DocgenConfig>(config.bytes())
        .map_err(|err| Diagnostic::new(format!("Invalid {PACKAGE_NAME} configuration: {err}")))?
    };

    let rc_dir = config
      .path()
      .parent()
      .filter(|p| !p.as_os_str().is_empty())
      .map(Path::to_path_buf);
    let project_root = options.project_root();
    let cwd_opt = std::env::current_dir().ok();

    let (root_dir, pkg_path, pkg_docgen) = if inline.source.is_some() {
      let root_dir = rc_dir.clone().unwrap_or_else(|| project_root.clone());
      let pkg_path = root_dir.join("package.json");
      let pkg = load_package_json(&pkg_path, options)
        .unwrap_or_default()
        .plugin_config
        .unwrap_or_default();
      (root_dir, pkg_path, pkg)
    } else {
      let mut candidates: Vec<PathBuf> = Vec::new();
      for candidate in [rc_dir.clone(), cwd_opt, Some(project_root.clone())]
        .into_iter()
        .flatten()
      {
        if !candidates
          .iter()
          .any(|existing| is_same_path(existing, &candidate))
        {
          candidates.push(candidate);
        }
      }

      let loaded: Vec<(PathBuf, PathBuf, Option<PackageJson>)> = candidates
        .into_iter()
        .map(|dir| {
          let pkg_path = dir.join("package.json");
          let pkg = load_package_json(&pkg_path, options);
          (dir, pkg_path, pkg)
        })
        .collect();

      let chosen = loaded
        .iter()
        .find(|(_, _, pkg)| {
          pkg
            .as_ref()
            .and_then(|p| p.plugin_config.as_ref())
            .and_then(|c| c.source.as_ref())
            .is_some()
        })
        .or_else(|| loaded.iter().find(|(_, _, pkg)| pkg.is_some()))
        .cloned();

      match chosen {
        Some((dir, pkg_path, pkg)) => (
          dir,
          pkg_path,
          pkg
            .unwrap_or_default()
            .plugin_config
            .unwrap_or_default(),
        ),
        None => {
          let dir = rc_dir.clone().unwrap_or(project_root);
          let pkg_path = dir.join("package.json");
          (dir, pkg_path, DocgenConfig::default())
        }
      }
    };

    let source = inline.source.or(pkg_docgen.source);
    let output = inline
      .output
      .map(|path| resolve_inline_path(config, rc_dir.is_some(), &path))
      .or(pkg_docgen.output);
    let tsconfig = inline
      .tsconfig
      .map(|path| resolve_inline_path(config, rc_dir.is_some(), &path))
      .or(pkg_docgen.tsconfig);

    Ok(ResolvedDocgenConfig {
      root_dir,
      pkg_path,
      source,
      output,
      tsconfig,
    })
  }
}

impl Plugin for DocgenReporter {
  fn new(config: &Config, options: &Options) -> Result<Self, Diagnostic> {
    let resolved = Self::resolve_config(config, options)?;
    Ok(Self { config: resolved })
  }

  fn build_start(&self, options: &Options) -> Result<(), Diagnostic> {
    let Some(ref source) = self.config.source else {
      return Err(missing_source_diagnostic(&self.config.pkg_path));
    };

    let project_root = options.project_root();
    let Some(cli_path) = find_docgen_cli(&self.config.root_dir, &project_root) else {
      return Err(Diagnostic::new(format!(
        "Could not locate {PACKAGE_NAME} CLI (dist/esm/cli.mjs) from \"{}\" or \"{}\".",
        self.config.root_dir.display(),
        project_root.display()
      )));
    };

    let mut cmd = Command::new("node");
    cmd
      .arg(&cli_path)
      .arg("--root")
      .arg(&self.config.root_dir)
      .arg("--source")
      .arg(source);

    if let Some(ref output) = self.config.output {
      cmd.arg("--output").arg(output);
    }
    if let Some(ref tsconfig) = self.config.tsconfig {
      cmd.arg("--tsconfig").arg(tsconfig);
    }

    let output = cmd
      .current_dir(&self.config.root_dir)
      .output()
      .map_err(|err| Diagnostic::new(format!("Failed to run parcel-docgen: {err}")))?;

    if !output.status.success() {
      let stderr = String::from_utf8_lossy(&output.stderr);
      let stdout = String::from_utf8_lossy(&output.stdout);
      return Err(Diagnostic::new(format!(
        "parcel-docgen failed:\n{}{}",
        stdout, stderr
      )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines().filter(|l| !l.trim().is_empty()) {
      options.log(LogLevel::Info, line);
    }

    Ok(())
  }
}

register_plugin!(DocgenReporter);

fn missing_source_diagnostic(pkg_path: &Path) -> Diagnostic {
  let mut frame = CodeFrame::file(pkg_path)
    .with_code(
      "{\n  \"@renr/parcel-reporter-docgen\": {\n    \"source\": \"../packages/ui/src/**/*.{ts,tsx}\",\n    \"output\": \"docs/components\"\n  }\n}",
    )
    .with_highlight(
      CodeHighlight::at(2, 3)
        .to(5, 4)
        .with_message(
          "Add a \"@renr/parcel-reporter-docgen\" source to generate docs for your UI components.",
        ),
    );
  frame.language = Some("json".to_owned());

  Diagnostic::new(format!(
    "No \"{PACKAGE_NAME}\" source found in .parcelrc or package.json.\nNOTE: Configure \"source\" in .parcelrc or in package.json under \"{PACKAGE_NAME}\"."
  ))
  .with_code_frame(frame)
  .with_hint(format!(
    "Add a \"{PACKAGE_NAME}\" config with a source glob (e.g. \"../packages/ui/src/**/*.{{ts,tsx}}\") in .parcelrc or package.json."
  ))
}

fn resolve_inline_path(config: &Config, has_rc_dir: bool, value: &str) -> String {
  if has_rc_dir {
    config.resolve_path(value).to_string_lossy().into_owned()
  } else {
    value.to_owned()
  }
}

fn load_package_json(path: &Path, options: &Options) -> Option<PackageJson> {
  let content = options.read_to_string(path).ok()?;
  serde_json::from_str(&content).ok()
}

fn is_same_path(a: &Path, b: &Path) -> bool {
  if a == b {
    return true;
  }
  match (fs::canonicalize(a), fs::canonicalize(b)) {
    (Ok(ca), Ok(cb)) => ca == cb,
    _ => false,
  }
}

fn find_docgen_cli(root_dir: &Path, project_root: &Path) -> Option<PathBuf> {
  let rel_cli = Path::new("node_modules/@renr/parcel-reporter-docgen/dist/esm/cli.mjs");

  for ancestor in root_dir.ancestors() {
    let candidate = ancestor.join(rel_cli);
    if candidate.is_file() {
      return Some(candidate);
    }
  }

  for ancestor in project_root.ancestors() {
    let candidate = ancestor.join(rel_cli);
    if candidate.is_file() {
      return Some(candidate);
    }
  }

  let workspace_candidate = project_root.join("packages/parcel-reporter-docgen/dist/esm/cli.mjs");
  if workspace_candidate.is_file() {
    return Some(workspace_candidate);
  }

  None
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::time::{SystemTime, UNIX_EPOCH};

  #[test]
  fn test_deserialize_docgen_config_and_package_json() {
    let inline: DocgenConfig = serde_json::from_str(
      r#"{"source":"src/components/**/*.tsx","output":"docs/components","tsconfig":"./tsconfig.json"}"#,
    )
    .expect("inline docgen config");
    assert_eq!(inline.source.as_deref(), Some("src/components/**/*.tsx"));
    assert_eq!(inline.output.as_deref(), Some("docs/components"));
    assert_eq!(inline.tsconfig.as_deref(), Some("./tsconfig.json"));

    let pkg: PackageJson = serde_json::from_str(
      r#"{"name":"app","@renr/parcel-reporter-docgen":{"source":"./src/*.tsx"}}"#,
    )
    .expect("package json");
    assert_eq!(
      pkg.plugin_config.and_then(|c| c.source).as_deref(),
      Some("./src/*.tsx")
    );
  }

  #[test]
  fn test_find_docgen_cli_walks_ancestors() {
    let unique = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .unwrap_or_default()
      .as_nanos();
    let base = std::env::temp_dir().join(format!("parcel-docgen-cli-test-{unique}"));
    let nested = base.join("apps/docs");
    let cli_file = base.join("node_modules/@renr/parcel-reporter-docgen/dist/esm/cli.mjs");

    fs::create_dir_all(&nested).unwrap();
    fs::create_dir_all(cli_file.parent().unwrap()).unwrap();
    fs::write(&cli_file, "export {};\n").unwrap();

    let found = find_docgen_cli(&nested, &base);
    assert_eq!(found.as_deref(), Some(cli_file.as_path()));

    let _ = fs::remove_dir_all(&base);
  }
}
