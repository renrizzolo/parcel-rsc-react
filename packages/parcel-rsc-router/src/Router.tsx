"use client";

import * as React from "react";
import { useSyncExternalStore } from "react";
import { createHistory } from "./history.js";
import { navigate as rscNavigate } from "./rsc.js";
import { RouteData } from "./types.js";
import { getPathData } from "./util.js";

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
} | null>(null);

export function useRouter() {
  const context = React.useContext(RouterContext);
  if (context === null) {
    throw new Error("useRouter must be used within a RouterProvider");
  }
  return context;
}

const LocationContext = React.createContext<Location | null>(null);

export function useLocation() {
  const context = React.useContext(LocationContext);
  if (context === null) {
    throw new Error("useLocation must be used within a RouterProvider");
  }
  return context;
}

export function useCurrentRoute() {
  const location = useLocation();
  const routes = useRoutes();
  return getPathData(location.pathname, routes);
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

  const navigate = React.useCallback(
    (to: string) => {
      if (!location?.href) {
        throw new Error("Location is not available");
      }

      if (location.href === new URL(to, location.href).href) {
        return;
      }

      // save scroll position for the current entry
      history.replace(location.href, {
        ...history.snapshot.state,
        key: history.snapshot.state?.key ?? Math.random().toString(36).slice(2),
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      });

      void rscNavigate(to, routes, (url) => {
        history.push(url, {
          key: Math.random().toString(36).slice(2),
          scrollX: 0,
          scrollY: 0,
        });
      });
    },
    [routes, location?.href]
  );

  const routerContextValue = React.useMemo(() => ({ navigate }), [navigate]);

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

  React.useLayoutEffect(() => {
    // hash scrolling takes priority
    if (location?.hash) {
      const element = document.querySelector(location.hash);
      if (element) {
        element.scrollIntoView();
        return;
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
