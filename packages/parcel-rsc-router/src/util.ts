"use client";
import { RouteData } from "./types.js";

// remove trailing slashes and index from the path
export const normalizeRoutePath = (path: string) => {
  for (const suffix of ["/", "/index"]) {
    if (path.endsWith(suffix)) {
      return path.slice(0, -suffix.length) || "/";
    }
  }

  return path;
};

// convert a path back to a route path
export const denormalizeRoutePath = (path: string) => {
  if (path === "/") {
    return "index";
  }

  if (path.startsWith("/")) {
    return path.substring(1);
  }

  return path;
};

export function getPathData(pathname: string, routes: RouteData[]) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost";

  // we want the pathname without the query string/hash to match the route
  const url = new URL(path, origin);
  const routePathName = normalizeRoutePath(url.pathname);

  const route = routes.find((route) => route.path === routePathName);

  if (!route) {
    return null;
  }

  // Preserve query string and hash while normalizing the path portion
  const normalizedPath = `${normalizeRoutePath(url.pathname)}${url.search}${url.hash}`;

  return {
    ...route,
    rsc: route.rsc,
    url: normalizedPath,
  };
}
