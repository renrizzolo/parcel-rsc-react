"use client";

import { type RSCRequestInit, fetchRSC } from "@parcel/rsc/client";
import { type ReactNode, createElement } from "react";
import { updateRoot } from "./client-entry.js";
import { getPathData } from "./util.js";
import { RouteData } from "./types.js";

// fetch and push an rsc route
export async function navigate(
  pathname: string,
  routes: RouteData[],
  /** callback for a successful navigation (use this to update the history) */
  onPush: (url: string) => void,
  { push = true }: { push?: boolean } = {}
) {
  console.log("client navigating to:", pathname);

  let shouldPush = push;

  const path = getPathData(pathname, routes);

  if (!path) {
    console.warn(`No route found for ${pathname}`);

    if (routes.some((r) => r.path === "/404")) {
      // we have a 404 page, navigate there
      void navigate("/404", routes, () => {
        // show the original not found path (rather than 404) in the URL
        onPush(pathname);
      });
    } else {
      // render a fallback 404
      updateRoot(createElement("h1", null, "404 Not Found"));
    }
    return;
  }

  // Don't add to history if we're already on this page
  if (path.url === location.pathname) {
    shouldPush = false;
  }

  try {
    const root = await fetchRSCWithPreloadCache<ReactNode>(path.rsc);

    updateRoot(root, () => {
      if (shouldPush) {
        onPush(path.url);
      }
    });

    // after a successful navigation, we can clear the cache
    // note everything is static currently, we don't need to clear the cache
    // fetchCache.clear();
  } catch (e) {
    console.log(`Error fetching ${path.path} RSC`, e);
  }
}

async function fetchRSCWithPreloadCache<T>(
  url: string | URL | Request,
  options?: RSCRequestInit
): Promise<T> {
  if (fetchCache.has(url)) {
    console.log("Cache hit", url);

    return fetchCache.get(url) as Promise<T>;
  }

  const promise = fetchRSC<T>(url, options);

  fetchCache.set(url, promise);

  // keep the cache small, removing the oldest entries
  while (fetchCache.size > 5) {
    const firstKey = fetchCache.keys().next().value;

    if (!firstKey) {
      break;
    }

    fetchCache.delete(firstKey);
  }

  return promise
    .then((data) => {
      return data;
    })
    .catch((error) => {
      fetchCache.delete(url);

      throw error;
    });
}

export const fetchCache = new Map<string | URL | Request, Promise<unknown>>();

export async function prefetch(
  pathname: string,
  routes: RouteData[],
  signal?: AbortSignal
) {
  const path = getPathData(pathname, routes);

  if (!path) {
    return;
  }

  try {
    await fetchRSCWithPreloadCache<ReactNode>(path.rsc, { signal });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error fetching ${pathname} RSC`, error);

      return;
    }

    // don't throw if the signal is aborted - this is expected
    if (signal?.aborted) {
      console.log(signal.reason);

      return;
    }
  }
}
