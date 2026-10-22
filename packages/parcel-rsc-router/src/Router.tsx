"use client";

import * as React from "react";
import { useSyncExternalStore } from "react";
import { createHistory } from "./history.js";
import { navigate as rscNavigate, prefetch as rscPrefetch } from "./rsc.js";
import { RouteData } from "./types.js";
import { getPathData } from "./util.js";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

const RoutesContext = React.createContext<RouteData[] | null>(null);

export const useRoutes = () => {
  const routes = React.useContext(RoutesContext);
  if (routes === null) {
    throw new Error("useRoutes must be used within a RouterProvider");
  }
  return routes;
};

const RouterContext = React.createContext<{
  navigate: (to: string) => void;
  prefetch: (to: string) => Promise<void>;
} | null>(null);

export function useRouter() {
  const context = React.useContext(RouterContext);
  if (context === null) {
    throw new Error("useRouter must be used within a RouterProvider");
  }
  return context;
}

const LocationContext = React.createContext<Location | null | undefined>(
  undefined
);

export function useLocation(): Location {
  const context = React.useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within a RouterProvider");
  }
  return context as Location;
}

export function useCurrentRoute() {
  const location = useLocation();
  const routes = useRoutes();
  return location ? getPathData(location.pathname, routes) : null;
}

const history = createHistory();

const ssrSnapshot = {
  location: null,
  state: null,
};

const getSsrSnapshot = () => ssrSnapshot;

export const RouterProvider = ({
  children,
  routes,
}: {
  children: React.ReactNode;
  routes: RouteData[];
}) => {
  // subscribe to history changes
  const { location, state } = useSyncExternalStore(
    history.subscribe,
    history.getSnapshot,
    getSsrSnapshot
  );

  const href = location?.href;

  const navigate = React.useCallback(
    (to: string) => {
      if (!href) {
        throw new Error("Location is not available");
      }

      const targetUrl = new URL(to, href);

      if (href === targetUrl.href) {
        return;
      }

      // save scroll position for the current entry
      history.replace(href, {
        ...history.snapshot.state,
        key: history.snapshot.state?.key ?? Math.random().toString(36).slice(2),
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      });

      // If only hash changed on the current page, skip RSC refetch and navigate directly
      if (
        location?.pathname === targetUrl.pathname &&
        location?.search === targetUrl.search &&
        location?.hash !== targetUrl.hash
      ) {
        history.push(targetUrl.pathname + targetUrl.search + targetUrl.hash, {
          key: Math.random().toString(36).slice(2),
          scrollX: window.scrollX,
          scrollY: window.scrollY,
        });
        return;
      }

      void rscNavigate(to, routes, (url) => {
        history.push(url, {
          key: Math.random().toString(36).slice(2),
          scrollX: 0,
          scrollY: 0,
        });
      });
    },
    [routes, href, location?.pathname, location?.search, location?.hash]
  );

  const prefetch = React.useCallback(
    async (to: string) => {
      await rscPrefetch(to, routes);
    },
    [routes]
  );

  const routerContextValue = React.useMemo(
    () => ({ navigate, prefetch }),
    [navigate, prefetch]
  );

  React.useEffect(() => {
    const handlePopState = () => {
      void rscNavigate(
        window.location.pathname,
        routes,
        () => {
          // noop, history is already updated
        },
        { push: false }
      );
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [routes]);

  useIsomorphicLayoutEffect(() => {
    // hash scrolling takes priority
    if (location?.hash) {
      try {
        const id = decodeURIComponent(location.hash.slice(1));
        const element =
          document.getElementById(id) ?? document.querySelector(location.hash);
        if (element) {
          element.scrollIntoView();
          return;
        }
      } catch {
        // Ignore invalid CSS selector syntax in hash
      }
    }

    // otherwise use saved scroll position
    if (state?.scrollY !== undefined) {
      window.scrollTo(state.scrollX, state.scrollY);
    } else {
      window.scrollTo(0, 0);
    }
  }, [location?.pathname, location?.hash, state]);

  return (
    <RoutesContext.Provider value={routes}>
      <LocationContext.Provider value={location}>
        <RouterContext.Provider value={routerContextValue}>
          {children}
        </RouterContext.Provider>
      </LocationContext.Provider>
    </RoutesContext.Provider>
  );
};
