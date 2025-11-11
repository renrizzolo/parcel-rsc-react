"use client";

import type { PageProps } from "@parcel/rsc";
import { Link, type RouteNode } from "@renr/parcel-rsc-router";
import { routeTree, routesByPage } from "../../routes";
import "./Nav.css";

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
        aria-current={blogPost.path === currentPage.url ? "page" : undefined}
      >
        {blogPost.slug}#hash-test
      </Link>
      <br />
      {/* @ts-expect-error */}
      <Link to="doesn't exist">doesn't exist</Link>
      <hr />
      <ul>
        <NavItem node={routeTree} currentPage={currentPage} />
      </ul>
    </nav>
  );
}

function NavItem({
  node,
  currentPage,
}: {
  node: RouteNode;
  currentPage: PageProps["currentPage"];
}) {
  return (
    <>
      <li>
        <Link
          to={node.path}
          aria-current={node.html === currentPage.url ? "page" : undefined}
        >
          {node.slug === "index" ? "Home" : node.slug}
        </Link>
      </li>
      <ul>
        {node.children.map((child) => (
          <NavItem key={child.path} node={child} currentPage={currentPage} />
        ))}
      </ul>
    </>
  );
}
