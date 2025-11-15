import type { PageProps } from "@parcel/rsc";
import { Link, type RouteNode } from "@renr/parcel-rsc-router";
import { routeTree, routesByPage } from "../../routes";

const blogPost = routesByPage["/blog/test_2024-10-31.html"];

export function Nav({
  currentPage,
}: {
  currentPage: PageProps["currentPage"];
}) {
  return (
    <nav>
      <h3>Navigation</h3>
      <p>
        <code>components/Nav.tsx</code> shows how to render a list of pages.
      </p>
      <Link
        to={blogPost.path}
        hash="hash-test"
        aria-current={blogPost.html === currentPage.url ? "page" : undefined}
      >
        {blogPost.slug}#hash-test
      </Link>
      <br />
      {/* @ts-expect-error */}
      <Link to="doesn't exist">doesn't exist</Link>
      <hr />
      <ul>
        <NavTree depth={2} node={routeTree} currentPage={currentPage} />
      </ul>
    </nav>
  );
}

export function NavTree({
  node,
  depth,
  currentPage,
}: {
  node: RouteNode;
  depth?: number;
  currentPage: PageProps["currentPage"];
}) {
  if (depth === 0) {
    return null;
  }

  return (
    <>
      <li>
        <Link
          to={node.path}
          aria-current={node.html === currentPage.url ? "page" : undefined}
        >
          {node.slug === "index" ? "Home" : node.slug}
        </Link>
        {node.children.length === 0 ? null : (
          <ul>
            {node.children.map((child) => (
              <NavTree
                key={child.path}
                depth={depth !== undefined ? depth - 1 : undefined}
                node={child}
                currentPage={currentPage}
              />
            ))}
          </ul>
        )}
      </li>
    </>
  );
}
