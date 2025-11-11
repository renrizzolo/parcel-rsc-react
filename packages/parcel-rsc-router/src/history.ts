"use client";

// basic history management

export type HistoryState = {
  key: string;
  scrollX: number;
  scrollY: number;
};

export function createHistory() {
  const listeners = new Set<() => void>();
  let currentSnapshot: {
    location: Location | null;
    state: HistoryState | null;
  };

  const getSnapshot = () => {
    const newSnapshot = {
      location: window.location,
      state: window.history.state as HistoryState | null,
    };
    // Only update currentSnapshot if something actually changed to prevent infinite loops
    if (
      !currentSnapshot ||
      currentSnapshot.location !== newSnapshot.location ||
      currentSnapshot.state !== newSnapshot.state
    ) {
      currentSnapshot = newSnapshot;
    }
    return currentSnapshot;
  };

  if (typeof window !== "undefined") {
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
      window.history.pushState(state, "", url);
      // notify listeners - do it in a microtask to avoid scheduling react updates
      queueMicrotask(() => listeners.forEach((listener) => listener()));
    },

    replace(url: string, state: HistoryState) {
      window.history.replaceState(state, "", url);
      // don't notify listeners on replace, as it's for non-navigation changes
    },
  };
}

export type BrowserHistory = ReturnType<typeof createHistory>;
