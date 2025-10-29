import { describe, it, expect } from "vitest";
import {
  buildRouteTree,
  flattenRouteTree,
  removeExtension,
  getRoutesByPagePath,
} from "./generate-routes.js";

const files = [
  "index.tsx",
  "about.tsx",
  "one/page.tsx",
  "one/two/web-development.md",
  "blog/index.js",
  "blog/2024-03-21-test.mdx",
  "blog/2024-01-01-test.mdx",
];

describe("generate-routes", () => {
  it("removeExtension", () => {
    expect(removeExtension("index.tsx")).toBe("index");
    expect(removeExtension("blog/[slug].tsx")).toBe("blog/[slug]");
  });

  it("buildRouteTree", () => {
    const tree = buildRouteTree(files);

    expect(tree).toEqual({
      path: "/",
      slug: "index",
      html: "/index.html",
      rsc: "/index.rsc",
      children: [
        {
          path: "/about",
          slug: "about",
          html: "/about.html",
          rsc: "/about.rsc",
          children: [],
        },
        {
          path: "/blog/index",
          slug: "index",
          html: "/blog/index.html",
          rsc: "/blog/index.rsc",
          children: [
            {
              path: "/blog/2024-01-01-test",
              slug: "2024-01-01-test",
              html: "/blog/2024-01-01-test.html",
              rsc: "/blog/2024-01-01-test.rsc",
              children: [],
            },
            {
              path: "/blog/2024-03-21-test",
              slug: "2024-03-21-test",
              html: "/blog/2024-03-21-test.html",
              rsc: "/blog/2024-03-21-test.rsc",
              children: [],
            },
          ],
        },
        {
          path: "/one/page",
          slug: "page",
          html: "/one/page.html",
          rsc: "/one/page.rsc",
          children: [
            {
              path: "/one/two/web-development",
              slug: "web-development",
              html: "/one/two/web-development.html",
              rsc: "/one/two/web-development.rsc",
              children: [],
            },
          ],
        },
      ],
    });
  });

  it("flattenRouteTree", () => {
    const tree = buildRouteTree(files);

    const flat = flattenRouteTree(tree);

    const expected = [
      {
        path: "/",
        slug: "index",
        rsc: "/index.rsc",
        html: "/index.html",
      },
      {
        path: "/about",
        slug: "about",
        rsc: "/about.rsc",
        html: "/about.html",
      },
      {
        path: "/blog/index",
        slug: "index",
        rsc: "/blog/index.rsc",
        html: "/blog/index.html",
      },
      {
        path: "/blog/2024-01-01-test",
        slug: "2024-01-01-test",
        rsc: "/blog/2024-01-01-test.rsc",
        html: "/blog/2024-01-01-test.html",
      },
      {
        path: "/blog/2024-03-21-test",
        slug: "2024-03-21-test",
        rsc: "/blog/2024-03-21-test.rsc",
        html: "/blog/2024-03-21-test.html",
      },
      {
        path: "/one/page",
        slug: "page",
        rsc: "/one/page.rsc",
        html: "/one/page.html",
      },
      {
        path: "/one/two/web-development",
        slug: "web-development",
        rsc: "/one/two/web-development.rsc",
        html: "/one/two/web-development.html",
      },
    ];

    expect(flat).toEqual(expected);
  });

  it("routesByPagePath", () => {
    const tree = buildRouteTree(files);
    const flat = flattenRouteTree(tree);
    const routesByPage = getRoutesByPagePath(flat);

    expect(routesByPage).toEqual({
      "/index.html": {
        path: "/",
        slug: "index",
        rsc: "/index.rsc",
        html: "/index.html",
      },
      "/about.html": {
        path: "/about",
        slug: "about",
        rsc: "/about.rsc",
        html: "/about.html",
      },
      "/blog/index.html": {
        path: "/blog/index",
        slug: "index",
        rsc: "/blog/index.rsc",
        html: "/blog/index.html",
      },
      "/blog/2024-01-01-test.html": {
        path: "/blog/2024-01-01-test",
        slug: "2024-01-01-test",
        rsc: "/blog/2024-01-01-test.rsc",
        html: "/blog/2024-01-01-test.html",
      },
      "/blog/2024-03-21-test.html": {
        path: "/blog/2024-03-21-test",
        slug: "2024-03-21-test",
        rsc: "/blog/2024-03-21-test.rsc",
        html: "/blog/2024-03-21-test.html",
      },
      "/one/page.html": {
        path: "/one/page",
        slug: "page",
        rsc: "/one/page.rsc",
        html: "/one/page.html",
      },
      "/one/two/web-development.html": {
        path: "/one/two/web-development",
        slug: "web-development",
        rsc: "/one/two/web-development.rsc",
        html: "/one/two/web-development.html",
      },
    });
  });
});
