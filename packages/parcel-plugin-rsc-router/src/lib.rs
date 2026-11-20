use std::collections::HashMap;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::SystemTime;

use parcel_plugin::{
  Asset, BuildSuccess, CodeFrame, CodeHighlight, Config, Diagnostic, Environment, LogLevel,
  Options, Plugin, register_plugin,
};
use serde::{Deserialize, Serialize};
use wax::Glob;

const ROUTER_PACKAGE_NAME: &str = "@renr/parcel-rsc-router";
const PACKAGE_NAME: &str = "@renr/parcel-plugin-rsc-router";
const CONFIG_PACKAGE_NAME: &str = "@renr/parcel-config-rsc-router";
const LEGACY_PACKAGE_NAME: &str = "@renr/parcel-reporter-rsc-router";
const ALLOWED_EXTENSIONS: &[&str] = &[".tsx", ".mdx", ".ts", ".jsx", ".js", ".md"];
const DISALLOWED_CHARS: &[char] = &[
  ' ', '\t', '\n', '\r', '\\', '?', '#', ':', '*', '<', '>', '|', '!', '$', '%',
];

#[derive(Debug, Default, Clone, Deserialize)]
struct ReporterConfig {
  source: Option<String>,
  output: Option<String>,
}

#[derive(Debug, Default, Clone, Deserialize)]
struct PackageJson {
  name: Option<String>,
  source: Option<serde_json::Value>,
  #[serde(rename = "@renr/parcel-plugin-rsc-router")]
  plugin_config: Option<ReporterConfig>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GeneratedRouteData {
  pub path: String,
  pub slug: String,
  pub rsc: String,
  pub html: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GeneratedRouteNode {
  pub path: String,
  pub slug: String,
  pub html: String,
  pub rsc: String,
  pub children: Vec<GeneratedRouteNode>,
}

#[derive(Default)]
struct RouteCache {
  page_files: HashMap<PathBuf, SystemTime>,
  last_bundle_contents: HashMap<PathBuf, Vec<u8>>,
}

#[derive(Debug, Clone)]
struct ResolvedPagesGlob {
  pattern: String,
  pages_dir: PathBuf,
  sub_glob: String,
}

#[derive(Debug, Clone)]
struct ResolvedProjectConfig {
  root_dir: PathBuf,
  pkg_path: PathBuf,
  pages: Option<ResolvedPagesGlob>,
  output_path: PathBuf,
}

pub struct RscRouterPlugin {
  config: ResolvedProjectConfig,
  cache: Mutex<RouteCache>,
}

impl RscRouterPlugin {
  fn resolve_project_config(
    config: &Config,
    options: &Options,
  ) -> Result<ResolvedProjectConfig, Diagnostic> {
    let inline = if config.bytes().is_empty() {
      ReporterConfig::default()
    } else {
      serde_json::from_slice::<ReporterConfig>(config.bytes())
        .map_err(|err| Diagnostic::new(format!("Invalid {PACKAGE_NAME} configuration: {err}")))?
    };

    let rc_dir = config
      .path()
      .parent()
      .filter(|p| !p.as_os_str().is_empty())
      .map(Path::to_path_buf);
    let project_root = options.project_root();
    let cwd_opt = std::env::current_dir().ok();

    let (root_dir, pkg_path, pkg_config, chosen_source, source_from_rc) =
      if inline.source.is_some() {
        let root_dir = rc_dir.clone().unwrap_or_else(|| project_root.clone());
        let pkg_path = root_dir.join("package.json");
        let pkg_config = load_package_json(&pkg_path, options).unwrap_or_default();
        (root_dir, pkg_path, pkg_config, inline.source.clone(), true)
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

        let filtered: Vec<(PathBuf, PathBuf, Option<PackageJson>)> = loaded
          .into_iter()
          .filter(|(dir, _, pkg)| !is_own_or_node_modules_dir(dir, pkg.as_ref()))
          .collect();

        let chosen = filtered
          .iter()
          .find(|(_, _, pkg)| has_route_source(pkg.as_ref()))
          .or_else(|| filtered.iter().find(|(_, _, pkg)| pkg.is_some()))
          .or_else(|| filtered.first())
          .cloned();

        let (root_dir, pkg_path, pkg_config) = match chosen {
          Some((dir, path, pkg)) => (dir, path, pkg.unwrap_or_default()),
          None => {
            let dir = project_root;
            let path = dir.join("package.json");
            (dir, path, PackageJson::default())
          }
        };

        let source = pkg_config
          .plugin_config
          .as_ref()
          .and_then(|c| c.source.clone())
          .or_else(|| {
            pkg_config
              .source
              .as_ref()
              .and_then(|s| s.as_str().map(ToOwned::to_owned))
              .filter(|s| !is_routes_entry(s))
          });

        (root_dir, pkg_path, pkg_config, source, false)
      };

    let output_path = if let Some(ref out) = inline.output {
      let resolved = if rc_dir.is_some() {
        config.resolve_path(out)
      } else {
        normalize_lexical_path(&root_dir, out)
      };
      finalize_output_path(resolved)
    } else if let Some(out) = pkg_config
      .plugin_config
      .as_ref()
      .and_then(|c| c.output.as_deref())
    {
      resolve_output_path(&root_dir, out)
    } else {
      resolve_output_path(&root_dir, "routes.ts")
    };

    let pages = chosen_source.map(|pattern| {
      let (dir_prefix, sub_glob) = split_glob_dir_and_pattern(&pattern);
      let pages_dir = if source_from_rc && rc_dir.is_some() {
        config.resolve_path(&dir_prefix)
      } else {
        normalize_lexical_path(&root_dir, &dir_prefix)
      };
      ResolvedPagesGlob {
        pattern,
        pages_dir,
        sub_glob,
      }
    });

    Ok(ResolvedProjectConfig {
      root_dir,
      pkg_path,
      pages,
      output_path,
    })
  }
}

impl Plugin for RscRouterPlugin {
  fn new(config: &Config, options: &Options) -> Result<Self, Diagnostic> {
    let resolved = Self::resolve_project_config(config, options)?;
    Ok(Self {
      config: resolved,
      cache: Mutex::new(RouteCache::default()),
    })
  }

  fn transform(&self, asset: &mut Asset, options: &Options) -> Result<(), Diagnostic> {
    if asset.target().environment() != Environment::ReactServer {
      return Ok(());
    }

    let asset_path = asset.file_path();
    if !is_same_path(&asset_path, &self.config.output_path) {
      return Ok(());
    }

    let Some(ref pages) = self.config.pages else {
      return Err(missing_source_diagnostic(&self.config.pkg_path));
    };

    // Track routes.ts via Parcel's Options::read_file so that adding/removing
    // a page (which updates routes.ts in build_start) invalidates this transform.
    let _ = options.read_file(&self.config.output_path);

    let mut files = get_files_and_normalize_paths(pages).map_err(Diagnostic::new)?;
    files.sort();

    let code = asset.content()?;
    let footer = format_routes_server_footer(&files, &pages.pages_dir, &self.config.output_path);
    asset.set_content(format!("{code}\n{footer}"));
    Ok(())
  }

  fn build_start(&self, options: &Options) -> Result<(), Diagnostic> {
    let Some(ref pages) = self.config.pages else {
      return Err(missing_source_diagnostic(&self.config.pkg_path));
    };

    let mut cache = self
      .cache
      .lock()
      .map_err(|_| Diagnostic::new("Failed to acquire route cache lock"))?;

    generate_routes_native(
      pages,
      &self.config.output_path,
      &mut cache,
      |message| options.log(LogLevel::Info, message),
    )
    .map_err(Diagnostic::new)
  }

  fn build_success(&self, event: &BuildSuccess, options: &Options) -> Result<(), Diagnostic> {
    let mut candidate_bundle: Option<(PathBuf, PathBuf)> = None;
    let mut current_bundles: HashMap<PathBuf, Vec<u8>> = HashMap::new();

    for bundle in event.bundle_graph.bundles() {
      if let Some(dist_path) = bundle.dist_path() {
        if let Ok(bytes) = fs::read(&dist_path) {
          if bundle.asset_type() == "js"
            && bundle.target().environment() == Environment::ReactServer
            && candidate_bundle.is_none()
            && std::str::from_utf8(&bytes)
              .map(|s| s.contains("PARCEL_RSC_PRERENDER"))
              .unwrap_or(false)
          {
            candidate_bundle = Some((dist_path.clone(), bundle.target().dist_dir()));
          }
          current_bundles.insert(dist_path, bytes);
        }
      }
    }

    let Some((bundle_path, dist_dir)) = candidate_bundle else {
      return Ok(());
    };

    if let Ok(cache) = self.cache.lock() {
      let html_exists = dist_dir.join("index.html").exists();
      if html_exists && cache.last_bundle_contents == current_bundles {
        return Ok(());
      }
    }

    let output = Command::new("node")
      .arg("--enable-source-maps")
      .arg(&bundle_path)
      .env("PARCEL_RSC_PRERENDER", "1")
      .env("PARCEL_RSC_OUT_DIR", &dist_dir)
      .current_dir(&self.config.root_dir)
      .output()
      .map_err(|err| Diagnostic::new(format!("Failed to execute node for prerendering: {err}")))?;

    if !output.status.success() {
      let stderr = String::from_utf8_lossy(&output.stderr);
      let stdout = String::from_utf8_lossy(&output.stdout);
      return Err(Diagnostic::new(format!(
        "Static prerendering failed ({}):\n{}{}",
        bundle_path.display(),
        stdout,
        stderr
      )));
    }

    if let Ok(mut cache) = self.cache.lock() {
      cache.last_bundle_contents = current_bundles;
    }

    options.log(LogLevel::Info, "✅ Static routes prerendered.");
    Ok(())
  }
}

register_plugin!(RscRouterPlugin);

fn missing_source_diagnostic(pkg_path: &Path) -> Diagnostic {
  let mut frame = CodeFrame::file(pkg_path)
    .with_code(
      "{\n  \"@renr/parcel-plugin-rsc-router\": {\n    \"source\": \"src/pages/**/*.{tsx,mdx}\",\n    \"output\": \"routes.ts\"\n  }\n}",
    )
    .with_highlight(
      CodeHighlight::at(2, 3)
        .to(5, 4)
        .with_message("Add a source glob to generate routes for your pages."),
    );
  frame.language = Some("json".to_owned());

  Diagnostic::new(
    "No route source found in .parcelrc or package.json.\nNOTE: Configure \"source\" in .parcelrc under @renr/parcel-plugin-rsc-router or in package.json.",
  )
  .with_code_frame(frame)
  .with_hint(
    "Add a source glob (e.g. \"src/pages/**/*.{tsx,mdx}\") to your @renr/parcel-plugin-rsc-router config in .parcelrc or package.json.",
  )
  .with_documentation_url("https://v3.parceljs.org/recipes/rsc/")
}

fn is_own_or_node_modules_dir(dir: &Path, pkg: Option<&PackageJson>) -> bool {
  if dir
    .components()
    .any(|c| c == Component::Normal("node_modules".as_ref()))
  {
    return true;
  }
  matches!(
    pkg.and_then(|p| p.name.as_deref()),
    Some(PACKAGE_NAME) | Some(CONFIG_PACKAGE_NAME)
  )
}

fn is_routes_entry(source: &str) -> bool {
  source == "routes.ts" || source.ends_with("/routes.ts") || source.ends_with("\\routes.ts")
}

fn has_route_source(pkg: Option<&PackageJson>) -> bool {
  let Some(pkg) = pkg else {
    return false;
  };
  pkg
    .plugin_config
    .as_ref()
    .and_then(|c| c.source.as_ref())
    .is_some()
    || pkg
      .source
      .as_ref()
      .and_then(|s| s.as_str())
      .is_some_and(|s| !is_routes_entry(s))
}

fn load_package_json(path: &Path, options: &Options) -> Option<PackageJson> {
  let content = options.read_to_string(path).ok()?;
  serde_json::from_str(&content).ok()
}

fn generate_routes_native<F>(
  pages: &ResolvedPagesGlob,
  routes_output_path: &Path,
  cache: &mut RouteCache,
  mut log: F,
) -> Result<(), String>
where
  F: FnMut(&str),
{
  if !pages.pages_dir.exists() {
    return Err(format!(
      "Pages directory \"{}\" does not exist.",
      pages.pages_dir.display()
    ));
  }

  let mut files = get_files_and_normalize_paths(pages)?;
  files.sort();

  let mut has_changes = false;
  if files.len() != cache.page_files.len() {
    has_changes = true;
  } else {
    for file in &files {
      let full_path = pages.pages_dir.join(file);
      let mtime = fs::metadata(&full_path)
        .and_then(|m| m.modified())
        .unwrap_or(SystemTime::UNIX_EPOCH);
      if cache.page_files.get(&full_path) != Some(&mtime) {
        has_changes = true;
        break;
      }
    }
  }

  if !has_changes && routes_output_path.exists() {
    return Ok(());
  }

  let route_tree = build_route_tree(&files)?;
  let flat_pages = flatten_route_tree(&route_tree);
  let formatted = format_routes_file(&flat_pages, &route_tree)?;

  write_generated_file(routes_output_path, &formatted, &mut log, flat_pages.len())?;
  update_page_files_cache(&files, &pages.pages_dir, cache);

  Ok(())
}

fn write_generated_file<F>(
  routes_type_path: &Path,
  formatted: &str,
  log: &mut F,
  page_count: usize,
) -> Result<(), String>
where
  F: FnMut(&str),
{
  if let Some(output_dir) = routes_type_path.parent() {
    if !output_dir.exists() {
      fs::create_dir_all(output_dir).map_err(|e| e.to_string())?;
    }
  }

  let auto_generated_string = format!("// This file is auto-generated by {PACKAGE_NAME}.");
  let legacy_auto_generated_string =
    format!("// This file is auto-generated by {LEGACY_PACKAGE_NAME}.");
  let old_content = if routes_type_path.exists() {
    let content = fs::read_to_string(routes_type_path).map_err(|e| e.to_string())?;
    if !content.contains(&auto_generated_string) && !content.contains(&legacy_auto_generated_string)
    {
      return Err(format!(
        "Cannot overwrite existing routes file at \"{}\" because it was not generated by {PACKAGE_NAME}. \n Please remove the file and try again.",
        routes_type_path.display()
      ));
    }
    Some(content)
  } else {
    None
  };

  if old_content.as_deref() == Some(formatted) {
    let file_name = routes_type_path
      .file_name()
      .and_then(|n| n.to_str())
      .unwrap_or("routes.ts");
    log(&format!("✅ {file_name} is up to date."));
    return Ok(());
  }

  fs::write(routes_type_path, formatted).map_err(|e| e.to_string())?;

  log(&format!(
    "✅ Routes generated at {} ({} pages)",
    normalize_path_to_posix(&routes_type_path.to_string_lossy()),
    page_count
  ));

  Ok(())
}

pub fn format_routes_server_footer(
  files: &[String],
  pages_dir: &Path,
  routes_file_path: &Path,
) -> String {
  let host_dir = routes_file_path.parent().unwrap_or_else(|| Path::new("."));

  let mut entries = Vec::new();

  for file in files {
    let page_abs = pages_dir.join(file);
    let is_ts_or_js = [".tsx", ".ts", ".jsx", ".js"]
      .iter()
      .any(|ext| file.ends_with(ext));
    let spec = relative_import_specifier(host_dir, &page_abs, is_ts_or_js);
    let html_key = convert_file_path_to_type(file, "html");
    entries.push(format!("        \"{html_key}\": await import(\"{spec}\"),"));
  }

  format!(
    "import {{ prerenderStaticSite as __prerenderStaticSite }} from \"{ROUTER_PACKAGE_NAME}/prerender\";\n\nif (\n  typeof process !== \"undefined\" &&\n  process.env?.PARCEL_RSC_PRERENDER === \"1\" &&\n  !(globalThis as Record<string, unknown>).__PARCEL_RSC_PRERENDERED__\n) {{\n  (globalThis as Record<string, unknown>).__PARCEL_RSC_PRERENDERED__ = true;\n  (async () => {{\n    await __prerenderStaticSite({{\n      routes: flatRoutes,\n      pages: {{\n{}\n      }},\n    }});\n    process.exit(0);\n  }})().catch((err) => {{\n    console.error(err);\n    process.exit(1);\n  }});\n}}\n",
    entries.join("\n")
  )
}

fn relative_import_specifier(from_dir: &Path, to_file: &Path, replace_ts_with_js: bool) -> String {
  let rel = diff_paths(to_file, from_dir).unwrap_or_else(|| to_file.to_path_buf());
  let mut rel_str = normalize_path_to_posix(&rel.to_string_lossy());
  if replace_ts_with_js {
    for ext in [".tsx", ".ts", ".jsx"] {
      if let Some(stripped) = rel_str.strip_suffix(ext) {
        rel_str = format!("{stripped}.js");
        break;
      }
    }
  }
  if !rel_str.starts_with("./") && !rel_str.starts_with("../") {
    format!("./{rel_str}")
  } else {
    rel_str
  }
}

fn diff_paths(path: &Path, base: &Path) -> Option<PathBuf> {
  let mut ita = path.components();
  let mut itb = base.components();
  let mut comps: Vec<Component> = vec![];
  loop {
    match (ita.next(), itb.next()) {
      (None, None) => break,
      (Some(a), None) => {
        comps.push(a);
        comps.extend(ita.by_ref());
        break;
      }
      (None, _) => comps.push(Component::ParentDir),
      (Some(a), Some(b)) if comps.is_empty() && a == b => (),
      (Some(a), Some(Component::CurDir)) => comps.push(a),
      (Some(_), Some(Component::ParentDir)) => return None,
      (Some(a), Some(_)) => {
        comps.push(Component::ParentDir);
        for _ in itb {
          comps.push(Component::ParentDir);
        }
        comps.push(a);
        comps.extend(ita.by_ref());
        break;
      }
    }
  }
  Some(comps.iter().map(|c| c.as_os_str()).collect())
}

fn normalize_lexical_path(base: &Path, path: impl AsRef<Path>) -> PathBuf {
  let joined = base.join(path);
  let mut resolved = PathBuf::new();
  for component in joined.components() {
    match component {
      Component::CurDir => {}
      Component::ParentDir => match resolved.file_name() {
        Some(_) => {
          resolved.pop();
        }
        None if resolved.has_root() => {}
        None => resolved.push(component),
      },
      component => resolved.push(component),
    }
  }
  resolved
}

fn update_page_files_cache(files: &[String], pages_dir: &Path, cache: &mut RouteCache) {
  cache.page_files.clear();
  for file in files {
    let full_path = pages_dir.join(file);
    if let Ok(mtime) = fs::metadata(&full_path).and_then(|m| m.modified()) {
      cache.page_files.insert(full_path, mtime);
    }
  }
}

pub fn build_route_tree(file_paths: &[String]) -> Result<GeneratedRouteNode, String> {
  let mut root_node = GeneratedRouteNode {
    path: "/".to_owned(),
    slug: "index".to_owned(),
    html: "/index.html".to_owned(),
    rsc: "/index.rsc".to_owned(),
    children: Vec::new(),
  };

  let mut found_root = false;
  let mut nodes = Vec::new();

  for file_path in file_paths {
    if let Some(ch) = file_path.chars().find(|c| DISALLOWED_CHARS.contains(c)) {
      return Err(format!(
        "File path \"{file_path}\" contains unsupported character: \"{ch}\"."
      ));
    }

    if remove_extension(file_path) == "index" {
      found_root = true;
      continue;
    }

    nodes.push(create_route_node(file_path));
  }

  if !found_root {
    return Err(
      "No root file found. Please ensure there is an index file in the pages directory root."
        .to_owned(),
    );
  }

  nodes.sort_by_key(|node| node.path.split('/').count());

  for node in nodes {
    insert_into_best_parent(&mut root_node, node);
  }

  Ok(root_node)
}

fn find_best_parent_path(current: &GeneratedRouteNode, node_path: &str, best_path: &mut String) {
  let is_potential = if current.path == "/" {
    node_path != "/"
  } else {
    node_path.starts_with(&format!("{}/", current.path))
  };

  if is_potential && node_path != current.path && current.path.len() > best_path.len() {
    *best_path = current.path.clone();
  }

  for child in &current.children {
    find_best_parent_path(child, node_path, best_path);
  }
}

fn insert_under_path(
  current: &mut GeneratedRouteNode,
  target_parent_path: &str,
  node: GeneratedRouteNode,
) -> bool {
  if current.path == target_parent_path {
    current.children.push(node);
    current.children.sort_by(|a, b| a.path.cmp(&b.path));
    return true;
  }

  for child in &mut current.children {
    if insert_under_path(child, target_parent_path, node.clone()) {
      return true;
    }
  }

  false
}

fn insert_into_best_parent(root_node: &mut GeneratedRouteNode, node: GeneratedRouteNode) {
  let mut best_path = "/".to_owned();
  find_best_parent_path(root_node, &node.path, &mut best_path);
  insert_under_path(root_node, &best_path, node);
}

fn create_route_node(file_path: &str) -> GeneratedRouteNode {
  let path = normalize_index(&remove_extension(file_path));
  let slug = path
    .split('/')
    .next_back()
    .filter(|s| !s.is_empty())
    .unwrap_or("index")
    .to_owned();

  GeneratedRouteNode {
    path: format!("/{path}"),
    slug,
    html: convert_file_path_to_type(file_path, "html"),
    rsc: convert_file_path_to_type(file_path, "rsc"),
    children: Vec::new(),
  }
}

fn normalize_index(file_path: &str) -> String {
  file_path
    .strip_suffix("/index")
    .unwrap_or(file_path)
    .to_owned()
}

pub fn flatten_route_tree(node: &GeneratedRouteNode) -> Vec<GeneratedRouteData> {
  let mut pages = Vec::new();

  if !node.rsc.is_empty() && !node.html.is_empty() {
    pages.push(GeneratedRouteData {
      path: node.path.clone(),
      slug: node.slug.clone(),
      rsc: node.rsc.clone(),
      html: node.html.clone(),
    });
  }

  for child in &node.children {
    pages.extend(flatten_route_tree(child));
  }

  pages
}

fn finalize_output_path(resolved: PathBuf) -> PathBuf {
  if (resolved.exists() && resolved.is_dir()) || resolved.extension().is_none() {
    return resolved.join("routes.ts");
  }
  resolved
}

pub fn resolve_output_path(root_dir: &Path, output_path: &str) -> PathBuf {
  finalize_output_path(normalize_lexical_path(root_dir, output_path))
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

fn get_files_and_normalize_paths(pages: &ResolvedPagesGlob) -> Result<Vec<String>, String> {
  let glob = Glob::new(&pages.sub_glob).map_err(|e| e.to_string())?;

  let mut files = Vec::new();
  for entry in glob.walk(&pages.pages_dir) {
    let entry = entry.map_err(|e| e.to_string())?;
    let path = entry.path();
    if path.is_file() && is_allowed_file(&path.to_string_lossy()) {
      if let Ok(rel) = path.strip_prefix(&pages.pages_dir) {
        files.push(normalize_path_to_posix(&rel.to_string_lossy()));
      }
    }
  }

  if files.is_empty() {
    return Err(format!(
      "No page files found matching pattern \"{}\" in directory \"{}\"",
      pages.pattern,
      pages.pages_dir.display()
    ));
  }

  Ok(files)
}

pub fn split_glob_dir_and_pattern(pattern: &str) -> (String, String) {
  let magic_chars = ['*', '?', '{', '['];
  let magic_idx = pattern
    .char_indices()
    .find(|&(_, ch)| magic_chars.contains(&ch))
    .map(|(idx, _)| idx)
    .unwrap_or(pattern.len());
  let prefix = &pattern[..magic_idx];
  if let Some(sep_idx) = prefix.rfind(['/', '\\']) {
    let dir = if sep_idx == 0 {
      prefix[..1].to_owned()
    } else {
      prefix[..sep_idx].to_owned()
    };
    let sub = normalize_ext_glob(&normalize_path_to_posix(&pattern[sep_idx + 1..]));
    (dir, sub)
  } else {
    (
      String::new(),
      normalize_ext_glob(&normalize_path_to_posix(pattern)),
    )
  }
}

fn normalize_ext_glob(pattern: &str) -> String {
  if let Some(start) = pattern.find(".(") {
    if let Some(end_offset) = pattern[start + 2..].find(')') {
      let end = start + 2 + end_offset;
      let inner = &pattern[start + 2..end].replace('|', ",");
      return format!("{}.{{{}}}{}", &pattern[..start], inner, &pattern[end + 1..]);
    }
  }
  pattern.to_owned()
}

fn normalize_path_to_posix(file_path: &str) -> String {
  file_path.replace('\\', "/")
}

fn format_route_data_ts(page: &GeneratedRouteData, indent: usize) -> String {
  let pad = " ".repeat(indent);
  let inner = " ".repeat(indent + 2);
  format!(
    "{pad}{{\n{inner}path: {:?},\n{inner}slug: {:?},\n{inner}rsc: {:?},\n{inner}html: {:?},\n{pad}}}",
    page.path, page.slug, page.rsc, page.html
  )
}

fn format_route_node_ts(node: &GeneratedRouteNode, indent: usize) -> String {
  let pad = " ".repeat(indent);
  let inner = " ".repeat(indent + 2);
  let children_str = if node.children.is_empty() {
    "[]".to_owned()
  } else {
    let items: Vec<String> = node
      .children
      .iter()
      .map(|child| format!("{},", format_route_node_ts(child, indent + 4)))
      .collect();
    format!("[\n{}\n{inner}]", items.join("\n"))
  };
  format!(
    "{pad}{{\n{inner}path: {:?},\n{inner}slug: {:?},\n{inner}html: {:?},\n{inner}rsc: {:?},\n{inner}children: {children_str},\n{pad}}}",
    node.path, node.slug, node.html, node.rsc
  )
}

fn format_routes_file(
  pages: &[GeneratedRouteData],
  route_tree: &GeneratedRouteNode,
) -> Result<String, String> {
  let mut routes_interface = Vec::new();
  for page in pages {
    let single_line = format!(
      "      \"{}\": {{ slug: \"{}\"; path: \"{}\"; rsc: \"{}\"; html: \"{}\" }};",
      page.path, page.slug, page.path, page.rsc, page.html
    );
    if single_line.len() <= 80 {
      routes_interface.push(single_line);
    } else {
      routes_interface.push(format!(
        "      \"{}\": {{\n        slug: \"{}\";\n        path: \"{}\";\n        rsc: \"{}\";\n        html: \"{}\";\n      }};",
        page.path, page.slug, page.path, page.rsc, page.html
      ));
    }
  }

  let flat_routes_items: Vec<String> = pages
    .iter()
    .map(|page| format!("{},", format_route_data_ts(page, 2)))
    .collect();
  let flat_routes_ts = format!("[\n{}\n]", flat_routes_items.join("\n"));

  let route_tree_ts = format_route_node_ts(route_tree, 0);

  let routes_by_page_items: Vec<String> = pages
    .iter()
    .map(|page| {
      format!(
        "  {:?}: {{\n    path: {:?},\n    slug: {:?},\n    rsc: {:?},\n    html: {:?},\n  }},",
        page.html, page.path, page.slug, page.rsc, page.html
      )
    })
    .collect();
  let routes_by_page_ts = format!("{{\n{}\n}}", routes_by_page_items.join("\n"));

  Ok(format!(
    "/* eslint-disable */\n\n// This file is auto-generated by {PACKAGE_NAME}.\n// Do not edit it manually.\n// You should also exclude it from your linting/formatting rules.\n\nimport type {{\n  App,\n  Page,\n  PageProps,\n  RouteData,\n  RouteHtml,\n  RouteNode,\n  RoutePath,\n}} from \"{ROUTER_PACKAGE_NAME}\";\n\nexport type {{ Page, PageProps, RouteHtml, RoutePath }};\n\ndeclare module \"{ROUTER_PACKAGE_NAME}\" {{\n  namespace App {{\n    interface Routes {{\n{}\n    }}\n  }}\n}}\n\nexport const flatRoutes = {} as const satisfies RouteData[];\n\nexport const routeTree = {} as const satisfies RouteNode;\n\n// lookup routes by PageProps url\nexport const routesByPage = {} satisfies {{\n  [Key in keyof App.Routes as App.Routes[Key][\"html\"]]: App.Routes[Key];\n}};\n",
    routes_interface.join("\n"),
    flat_routes_ts,
    route_tree_ts,
    routes_by_page_ts
  ))
}

fn convert_file_path_to_type(file_name: &str, file_type_to: &str) -> String {
  format!("/{}.{}", remove_extension(file_name), file_type_to)
}

fn is_allowed_file(file: &str) -> bool {
  ALLOWED_EXTENSIONS.iter().any(|ext| file.ends_with(ext))
}

pub fn remove_extension(file: &str) -> String {
  for ext in ALLOWED_EXTENSIONS {
    if let Some(stripped) = file.strip_suffix(ext) {
      return stripped.to_owned();
    }
  }
  file.to_owned()
}

#[cfg(test)]
mod tests {
  use super::*;

  fn sample_files() -> Vec<String> {
    vec![
      "one/two/web-development.md".to_owned(),
      "blog/2024-03-21-test.mdx".to_owned(),
      "index.tsx".to_owned(),
      "about.tsx".to_owned(),
      "one/page/two.md".to_owned(),
      "one/page.tsx".to_owned(),
      "blog/2024-01-01-test.mdx".to_owned(),
      "blog/index.js".to_owned(),
    ]
  }

  #[test]
  fn test_remove_extension() {
    assert_eq!(remove_extension("index.tsx"), "index");
    assert_eq!(remove_extension("blog/slug.tsx"), "blog/slug");
  }

  #[test]
  fn test_build_route_tree_and_flatten() {
    let files = sample_files();
    let tree = build_route_tree(&files).expect("route tree");
    assert_eq!(tree.path, "/");
    assert_eq!(tree.children.len(), 4);

    let flat = flatten_route_tree(&tree);
    assert_eq!(flat.len(), 8);
    assert_eq!(flat[0].path, "/");
    assert_eq!(flat[1].path, "/about");
    assert_eq!(flat[2].path, "/blog");
    assert_eq!(flat[3].path, "/blog/2024-01-01-test");
    assert_eq!(flat[4].path, "/blog/2024-03-21-test");
    assert_eq!(flat[5].path, "/one/page");
    assert_eq!(flat[6].path, "/one/page/two");
    assert_eq!(flat[7].path, "/one/two/web-development");
  }

  #[test]
  fn test_resolve_output_path() {
    let root = Path::new("/project/root");
    assert_eq!(
      resolve_output_path(root, "routes.ts"),
      root.join("routes.ts")
    );
    assert_eq!(
      resolve_output_path(root, "apps/my-app/src/routes.ts"),
      root.join("apps/my-app/src/routes.ts")
    );
    assert_eq!(
      resolve_output_path(root, "apps/my-app/src"),
      root.join("apps/my-app/src/routes.ts")
    );
    assert_eq!(
      resolve_output_path(root, "./src/routes.ts"),
      root.join("src/routes.ts")
    );
  }

  #[test]
  fn test_split_glob_dir_and_pattern() {
    assert_eq!(
      split_glob_dir_and_pattern("src/pages/**/*.{tsx,mdx}"),
      ("src/pages".to_owned(), "**/*.{tsx,mdx}".to_owned())
    );
    assert_eq!(
      split_glob_dir_and_pattern("./src/pages/**/*.{tsx,mdx}"),
      ("./src/pages".to_owned(), "**/*.{tsx,mdx}".to_owned())
    );
    assert_eq!(
      split_glob_dir_and_pattern("../pages/**/*.tsx"),
      ("../pages".to_owned(), "**/*.tsx".to_owned())
    );
    assert_eq!(
      split_glob_dir_and_pattern("src/pages/**/*.(js|jsx|ts|tsx|md|mdx)"),
      (
        "src/pages".to_owned(),
        "**/*.{js,jsx,ts,tsx,md,mdx}".to_owned()
      )
    );
    assert_eq!(
      split_glob_dir_and_pattern("*.tsx"),
      (String::new(), "*.tsx".to_owned())
    );
  }

  #[test]
  fn test_is_routes_entry() {
    assert!(is_routes_entry("routes.ts"));
    assert!(is_routes_entry("./routes.ts"));
    assert!(is_routes_entry("src/routes.ts"));
    assert!(is_routes_entry("src\\routes.ts"));
    assert!(!is_routes_entry("src/pages/**/*.{tsx,mdx}"));
    assert!(!is_routes_entry("my-routes.ts"));
  }

  #[test]
  fn test_is_own_or_node_modules_dir() {
    assert!(is_own_or_node_modules_dir(
      Path::new("/project/node_modules/@renr/parcel-config-rsc-router"),
      None
    ));
    let cfg_pkg = PackageJson {
      name: Some(CONFIG_PACKAGE_NAME.to_owned()),
      ..Default::default()
    };
    assert!(is_own_or_node_modules_dir(
      Path::new("/repo/packages/parcel-config-rsc-router"),
      Some(&cfg_pkg)
    ));
    let plugin_pkg = PackageJson {
      name: Some(PACKAGE_NAME.to_owned()),
      ..Default::default()
    };
    assert!(is_own_or_node_modules_dir(
      Path::new("/repo/packages/parcel-plugin-rsc-router"),
      Some(&plugin_pkg)
    ));
    let app_pkg = PackageJson {
      name: Some("my-static-site".to_owned()),
      ..Default::default()
    };
    assert!(!is_own_or_node_modules_dir(
      Path::new("/repo/apps/my-static-site"),
      Some(&app_pkg)
    ));
  }

  #[test]
  fn test_format_routes_server_footer() {
    let root = Path::new("/project");
    let pages_dir = root.join("src/pages");
    let routes_path = root.join("routes.ts");
    let files = vec!["index.tsx".to_owned(), "mdx-page.mdx".to_owned()];

    let content = format_routes_server_footer(&files, &pages_dir, &routes_path);
    assert!(content.contains(
      "import { prerenderStaticSite as __prerenderStaticSite } from \"@renr/parcel-rsc-router/prerender\";"
    ));
    assert!(!content.contains("await import(\"../../routes.js\")"));
    assert!(content.contains("\"/index.html\": await import(\"./src/pages/index.js\"),"));
    assert!(content.contains("\"/mdx-page.html\": await import(\"./src/pages/mdx-page.mdx\"),"));
  }
}
