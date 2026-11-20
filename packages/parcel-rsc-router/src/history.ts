"use client";

// basic history management

export type HistoryState = {
  key: string;
  scrollX: number;
  scrollY: number;
};

export function createHistory() {
  const listeners = new Set<() => void>();
  let lastHref: string | null = null;
  let lastState: HistoryState | null = null;
  let currentSnapshot: {
    location: Location | null;
    state: HistoryState | null;
  };

  const getSnapshot = () => {
    if (typeof window === "undefined") {
      return {
        location: null,
        state: null,
      };
    }

    const currentHref = window.location.href;
    const currentState = window.history.state as HistoryState | null;

    // Only update currentSnapshot if something actually changed to prevent infinite loops
    if (
      !currentSnapshot ||
      currentHref !== lastHref ||
      currentState !== lastState
    ) {
      lastHref = currentHref;
      lastState = currentState;
      currentSnapshot = {
        location: window.location,
        state: currentState,
      };
    }
    return currentSnapshot;
  };

  if (typeof window !== "undefined") {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    window.addEventListener("popstate", () => {
      // notify listeners - do it in a microtask to avoid scheduling react updates
      queueMicrotask(() => listeners.forEach((listener) => listener()));
    });
  }

  return {
    get snapshot() {
      return getSnapshot();
    },

    getSnapshot,

    subscribe(this: void, listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    push(url: string, state: HistoryState) {
      if (typeof window !== "undefined") {
        window.history.pushState(state, "", url);
      }
      // notify listeners - do it in a microtask to avoid scheduling react updates
      queueMicrotask(() => listeners.forEach((listener) => listener()));
    },

    replace(url: string, state: HistoryState) {
      if (typeof window !== "undefined") {
        window.history.replaceState(state, "", url);
      }
      // don't notify listeners on replace, as it's for non-navigation changes
    },
  };
}

export type BrowserHistory = ReturnType<typeof createHistory>;
