import fs from "fs";
import path from "path";
import prettier from "prettier";
import type { RouteNode, RouteData } from "@renr/parcel-rsc-router";
import { glob } from "tinyglobby";

const routerPackageName = "@renr/parcel-rsc-router";
const packageName = "@renr/parcel-reporter-rsc-router";
const allowedPageFileExtensions = [".tsx", ".mdx", ".ts", ".jsx", ".js", ".md"];

// we can't allow whitespace because parcel will bundle the file with the space rather than encoding it,
// so we can't properly match it to the url (and/or there's a bug with how parcel's server resolves files with spaces?).
// special chars \ ? # : * < > | ! $ % don't make sense to be in file names/urls either.
const disallowedCharsRegex = /[\s\\?#:*<>|!$%]/;

export function buildRouteTree(filePaths: string[]): RouteNode {
  const rootNode: RouteNode = {
    path: "/",
    slug: "index",
    html: "/index.html",
    rsc: "/index.rsc",
    children: [],
  };

  if (!filePaths.some((filePath) => removeExtension(filePath) === "index")) {
    throw new Error(
      `No root index file found. Please ensure there is an index file in the pages directory.`
    );
  }

  const nodes = filePaths
    .filter((filePath) => {
      let match;

      while ((match = disallowedCharsRegex.exec(filePath)) !== null) {
        throw new Error(
          `File path "${filePath}" contains unsupported character: "${match[0]}".`
        );
      }

      // skip the the root - `rootNode` is already created as our initial node
      // TODO - would be less ambiguous if this is actually called "root"
      return removeExtension(filePath) !== "index";
    })
    .map((filePath) => createRouteNode(filePath));

  // sort nodes by path depth, to make it easier to find parents
  nodes.sort((a, b) => a.path.split("/").length - b.path.split("/").length);

  for (const node of nodes) {
    let bestParent = rootNode;
    // track the length of the best parent's path
    let bestParentPathLength = 0;

    // recursively find the parent this node should be inserted under
    function findParent(potentialParent: RouteNode) {
      let isPotentialParent = false;
      if (potentialParent.path === "/") {
        // if potential parent is root, any node that is not root itself is a potential child
        isPotentialParent = node.path !== "/";
      } else {
        // for non-root potential parents, the node's path must start with parent's path segment
        isPotentialParent = node.path.startsWith(potentialParent.path + "/");
      }

      if (isPotentialParent && node.path !== potentialParent.path) {
        // if the potential parent's path is longer than the current best, it's a better match
        if (potentialParent.path.length > bestParentPathLength) {
          bestParentPathLength = potentialParent.path.length;
          bestParent = potentialParent;
        }
      }

      // recursively search in children of the potential parent
      for (const child of potentialParent.children) {
        findParent(child);
      }
    }

    // start searching from the root node
    findParent(rootNode);
    // insert the node under the best parent found
    bestParent.children.push(node);
    // keep children sorted by path
    bestParent.children.sort((a, b) => a.path.localeCompare(b.path));
  }

  return rootNode;
}

/**
 * create a RouteNode from a file path
 */
function createRouteNode(filePath: string): RouteNode {
  const path = normalizeIndex(removeExtension(filePath));

  return {
    path: `/${path}`,
    slug: path.split("/").pop() || "index",
    html: convertFilePathToType(filePath, "html"),
    rsc: convertFilePathToType(filePath, "rsc"),
    children: [],
  };
}

function normalizeIndex(filePath: string): string {
  // remove the trailing /index for paths that are index files
  // e.g /blog/index becomes /blog
  return filePath.endsWith("/index")
    ? filePath.substring(0, filePath.length - "/index".length)
    : filePath;
}

/** flatten a RouteNode tree into a list of RouteData pages */
export function flattenRouteTree(node: RouteNode): RouteData[] {
  const pages: RouteData[] = [];

  if (node.rsc && node.html) {
    pages.push({
      path: node.path,
      slug: node.slug,
      rsc: node.rsc,
      html: node.html,
    });
  }

  for (const child of node.children) {
    pages.push(...flattenRouteTree(child));
  }

  return pages;
}

/** generate a lookup of routes by their html path (parcel RSC's Page['url']) */
export function getRoutesByPagePath(pages: RouteData[]) {
  return pages.reduce(
    (acc, page) => {
      acc[page.html] = page;
      return acc;
    },
    {} as Record<string, RouteData>
  );
}

/** generates a routes.ts file in the outputDir from pages found in pagesDir */
export async function generateRoutes(
  pagesPattern: string,
  rootDir: string,
  log = console.log
) {
  const resolvedPagesDir = path.resolve(
    rootDir,
    getBasePathFromGlob(pagesPattern)
  );

  if (!fs.existsSync(resolvedPagesDir)) {
    throw new Error(`Pages directory "${resolvedPagesDir}" does not exist.`);
  }

  const files = (await getFilesAndNormalizePaths(pagesPattern, rootDir)).sort(
    (a, b) => a.localeCompare(b)
  );

  const routeTree = buildRouteTree(files);
  const pages = flattenRouteTree(routeTree);

  const routesByPage = getRoutesByPagePath(pages);

  const routesType = buildRoutesType(pages);
  const routesTypePath = path.resolve(rootDir, "routes.ts");

  const routesTypeContent = `
    /* eslint-disable */
      
    // This file is auto-generated by ${packageName}. 
    // Do not edit it manually.
    // You should also exclude it from your linting/formatting rules.
    
    import type { App, RouteData, RouteNode } from '${routerPackageName}';
    
        ${routesType}

        export const flatRoutes = ${JSON.stringify(pages, null, 2)} as const satisfies RouteData[];

        export const routeTree = ${JSON.stringify(
          routeTree,
          null,
          2
        )} as const satisfies RouteNode;

        // lookup routes by PageProps url
        export const routesByPage = ${JSON.stringify(
          routesByPage,
          null,
          2
        )} satisfies {
            [Key in keyof App.Routes as App.Routes[number]["html"]]: App.Routes[Key];
          };

`;

  // TODO - see if we can use the consumer's prettier config
  const formatted = await prettier.format(routesTypeContent, {
    parser: "typescript",
  });

  // only write the file if the content has changed
  if (fs.existsSync(routesTypePath)) {
    const oldContent = fs.readFileSync(routesTypePath, "utf-8");
    if (oldContent === formatted) {
      return;
    }
  }

  fs.writeFileSync(routesTypePath, formatted, "utf-8");
  log(`Routes generated at ${routesTypePath}`);
}

/** normalize file paths to use posix style */
async function getFilesAndNormalizePaths(
  pagesPattern: string,
  rootDir: string
) {
  const basePath = getBasePathFromGlob(pagesPattern);

  const files = (
    await glob(pagesPattern, {
      cwd: rootDir,
    })
  )
    .filter((file) => {
      if (typeof file !== "string") {
        throw new Error("expected file to be a string");
      }

      const filePath = path.join(rootDir, file);

      return fs.statSync(filePath).isFile() && isAllowedFile(filePath);
    })
    .map((file) => {
      return (
        file
          // remove the base path (src/pages/blog/index.tsx -> blog/index.tsx)
          .substring(basePath.length)
          // normalize Windows paths to use forward slashes
          .replace(/\\/g, "/")
      );
    });

  if (files.length === 0) {
    throw new Error(
      `No page files found matching pattern "${pagesPattern}" in directory "${rootDir}"`
    );
  }

  return files;
}

/**
 * Given a glob, returns the part of the path before the first glob pattern
 *
 * eg: `src/pages/**\/*.tsx -> src/pages/`
 **/
function getBasePathFromGlob(globPattern: string): string {
  // find the first occurrence of a glob character
  const magicChars = ["*", "?", "{", "["];
  let basePath = globPattern;

  for (const char of magicChars) {
    const index = basePath.indexOf(char);
    if (index !== -1) {
      basePath = basePath.substring(0, index);
    }
  }

  return basePath;
}

function buildRoutesType(pages: RouteData[]) {
  const routes = pages.map((page) => {
    const { path, slug, rsc, html } = page;
    return `'${path}': { slug: '${slug}', rsc: '${rsc}', html: '${html}' };`;
  });

  // this generates a module augmentation for the router package
  // so that the routes are typed in the consumer's app
  return `
  declare module "${routerPackageName}" {
    namespace App {
      interface Routes {
        ${routes.join("\n")}
      }
    }
  }`;
}

const extensionRegex = new RegExp(`(${allowedPageFileExtensions.join("|")})$`);

function convertFilePathToType<T extends "rsc" | "html">(
  fileName: string,
  fileTypeTo: T
): `/${string}.${T}` {
  // make sure the rsc path is always prefixed with a slash
  // so we don't fetch from a sub-path
  return `/${fileName.replace(extensionRegex, "")}.${fileTypeTo}`;
}

function isAllowedFile(file: string): boolean {
  return allowedPageFileExtensions.some((ext) => file.endsWith(ext));
}

export function removeExtension(file: string): string {
  return file.replace(extensionRegex, "");
}
