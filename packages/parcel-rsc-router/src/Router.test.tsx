import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RouterProvider,
  useCurrentRoute,
  useLocation,
  useRouter,
} from "./Router.js";
import { navigate as rscNavigate } from "./rsc.js";
import { RouteData } from "./types.js";

// Mock rscNavigate
vi.mock("./rsc", () => ({
  navigate: vi.fn(),
}));

// Mock window.scrollTo
const originalScrollTo = window.scrollTo;

describe("Router", () => {
  const mockRoutes: RouteData[] = [
    { path: "/", rsc: "/index.rsc", html: "/index.html", slug: "index" },
    { path: "/about", rsc: "/about.rsc", html: "/about.html", slug: "about" },
    { path: "/blog", rsc: "/blog.rsc", html: "/blog.html", slug: "blog" },
  ];

  let mockElement: HTMLDivElement;

  beforeEach(() => {
    // Reset history state and location before each test
    window.history.replaceState(null, "", "http://localhost:3000/");

    window.scrollTo = vi.fn();
    // Mock scrollIntoView
    mockElement = document.createElement("div");
    mockElement.id = "section1";
    mockElement.setAttribute("data-testid", "section1");
    mockElement.scrollIntoView = vi.fn();
    document.body.appendChild(mockElement);

    vi.mocked(rscNavigate).mockImplementation(async (to, routes, onPush) => {
      // Simulate successful navigation
      onPush(to);
    });
  });

  afterEach(() => {
    window.scrollTo = originalScrollTo;
    document.body.removeChild(mockElement);
    vi.clearAllMocks();
  });

  const TestComponent = () => {
    const { navigate } = useRouter();
    const location = useLocation();
    const currentRoute = useCurrentRoute();

    return (
      <div>
        <span data-testid="pathname">{location.pathname}</span>
        <span data-testid="current-route-path">{currentRoute?.path}</span>
        <button onClick={() => navigate("/about")}>Go to About</button>
        <button onClick={() => navigate("/blog#section1")}>
          Go to Blog with Hash
        </button>
      </div>
    );
  };

  it("should provide navigate function via useRouter", async () => {
    render(
      <RouterProvider routes={mockRoutes}>
        <TestComponent />
      </RouterProvider>
    );

    expect(screen.getByTestId("pathname").textContent).toBe("/");
    expect(screen.getByTestId("current-route-path").textContent).toBe("/");

    fireEvent.click(screen.getByText("Go to About"));

    await waitFor(() => {
      expect(rscNavigate).toHaveBeenCalledWith(
        "/about",
        mockRoutes,
        expect.any(Function)
      );
    });
  });

  it("should update location and current route on navigation", async () => {
    render(
      <RouterProvider routes={mockRoutes}>
        <TestComponent />
      </RouterProvider>
    );

    fireEvent.click(screen.getByText("Go to About"));

    await waitFor(() => {
      expect(screen.getByTestId("pathname").textContent).toBe("/about");
      expect(screen.getByTestId("current-route-path").textContent).toBe(
        "/about"
      );
    });
  });

  it("should save scroll position on navigation and restore on popstate", async () => {
    // Set initial scroll position
    window.scrollY = 100;
    window.scrollX = 50;

    render(
      <RouterProvider routes={mockRoutes}>
        <TestComponent />
      </RouterProvider>
    );

    // Navigate away
    fireEvent.click(screen.getByText("Go to About"));

    await waitFor(() => {
      expect(screen.getByTestId("pathname").textContent).toBe("/about");
    });

    // Expect scroll to top for new page
    await waitFor(() => {
      expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    });

    act(() => {
      window.history.back();
    });

    // Expect scroll to be restored
    await waitFor(() => {
      expect(window.scrollTo).toHaveBeenCalledWith(50, 100);
    });
  });

  it("should scroll to hash if present", async () => {
    render(
      <RouterProvider routes={mockRoutes}>
        <TestComponent />
      </RouterProvider>
    );

    fireEvent.click(screen.getByText("Go to Blog with Hash"));

    await waitFor(() => {
      // Expect scrollIntoView to be called on the hash element
      // oxlint-disable-next-line unbound-method
      expect(screen.getByTestId("section1").scrollIntoView).toHaveBeenCalled();
    });
  });
});
