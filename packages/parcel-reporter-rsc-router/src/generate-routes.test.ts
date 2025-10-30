import { describe, it, expect } from "vitest";
import {
  buildRouteTree,
  flattenRouteTree,
  removeExtension,
  getRoutesByPagePath,
} from "./generate-routes.js";

const files = [
  "one/two/web-development.md",
  "blog/2024-03-21-test.mdx",
  "root.tsx",
  "about.tsx",
  "one/page/two.md",
  "one/page.tsx",
  "blog/2024-01-01-test.mdx",
  "blog/index.js",
];

describe("generate-routes", () => {
  it("removeExtension", () => {
    expect(removeExtension("index.tsx")).toBe("index");
    expect(removeExtension("blog/slug.tsx")).toBe("blog/slug");
  });

  it("buildRouteTree", () => {
    const tree = buildRouteTree(files);
    console.log(JSON.stringify(tree, null, 2));
    expect(tree).toEqual({
      path: "/",
      slug: "root",
      html: "/root.html",
      rsc: "/root.rsc",
      children: [
        {
          path: "/about",
          slug: "about",
          html: "/about.html",
          rsc: "/about.rsc",
          children: [],
        },
        {
          path: "/blog",
          slug: "blog",
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
              html: "/one/page/two.html",
              path: "/one/page/two",
              rsc: "/one/page/two.rsc",
              slug: "two",
              children: [],
            },
          ],
        },
        {
          path: "/one/two/web-development",
          slug: "web-development",
          html: "/one/two/web-development.html",
          rsc: "/one/two/web-development.rsc",
          children: [],
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
        slug: "root",
        rsc: "/root.rsc",
        html: "/root.html",
      },
      {
        path: "/about",
        slug: "about",
        rsc: "/about.rsc",
        html: "/about.html",
      },
      {
        path: "/blog",
        slug: "blog",
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
        html: "/one/page/two.html",
        path: "/one/page/two",
        rsc: "/one/page/two.rsc",
        slug: "two",
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
      "/root.html": {
        path: "/",
        slug: "root",
        rsc: "/root.rsc",
        html: "/root.html",
      },
      "/about.html": {
        path: "/about",
        slug: "about",
        rsc: "/about.rsc",
        html: "/about.html",
      },
      "/blog/index.html": {
        path: "/blog",
        slug: "blog",
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
      "/one/page/two.html": {
        html: "/one/page/two.html",
        path: "/one/page/two",
        rsc: "/one/page/two.rsc",
        slug: "two",
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
