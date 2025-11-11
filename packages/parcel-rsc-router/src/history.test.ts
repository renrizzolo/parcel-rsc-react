import { beforeAll, describe, expect, it, vi } from "vitest";
import { BrowserHistory, createHistory, HistoryState } from "./history.js";

let history: BrowserHistory;

beforeAll(() => {
  history = createHistory();
});

describe("history", () => {
  it("should initialize with current location and null state", () => {
    expect(history).toBeDefined();

    const { snapshot } = history;

    expect(snapshot.location?.pathname).toBe("/");
    expect(snapshot.state).toBeNull();
  });

  it("should call pushState and notify listeners on push", async () => {
    const listener = vi.fn();
    history.subscribe(listener);

    const url = "/new-path";
    const state: HistoryState = { key: "123", scrollX: 0, scrollY: 0 };
    history.push(url, state);

    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(history.snapshot.location?.pathname).toBe("/new-path");
    expect(history.snapshot.state).toEqual(state);
  });

  it("should call replaceState on replace", () => {
    const listener = vi.fn();
    history.subscribe(listener);

    const url = "/replaced-path";
    const state: HistoryState = { key: "456", scrollX: 100, scrollY: 200 };
    history.replace(url, state);

    expect(listener).not.toHaveBeenCalled(); // replace should not notify listeners
    expect(history.snapshot.location?.pathname).toBe("/replaced-path");
    expect(history.snapshot.state).toEqual(state);
  });

  it("should notify listeners on popstate event", async () => {
    const listener = vi.fn();
    history.subscribe(listener);

    // Simulate popstate event
    const popStateEvent = new PopStateEvent("popstate", {
      state: { key: "pop", scrollX: 10, scrollY: 20 },
    });

    window.dispatchEvent(popStateEvent);

    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("should unsubscribe a listener", () => {
    const listener = vi.fn();
    const unsubscribe = history.subscribe(listener);
    unsubscribe();

    const url = "/another-path";
    const state: HistoryState = { key: "789", scrollX: 0, scrollY: 0 };
    history.push(url, state);

    expect(listener).not.toHaveBeenCalled();
  });
});
