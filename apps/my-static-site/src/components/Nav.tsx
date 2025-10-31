"use client";
import type { PageProps } from "@parcel/rsc";
import type { RouteNode } from "@renr/parcel-rsc-router";
import "./Nav.css";
import { routeTree } from "../../routes";

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
        <a
          href={node.html}
          aria-current={node.html === currentPage.url ? "page" : undefined}
        >
          {node.slug === "index" ? "Home" : node.slug}
        </a>
      </li>
      <ul>
        {node.children.map((child) => (
          <NavItem key={child.path} node={child} currentPage={currentPage} />
        ))}
      </ul>
    </>
  );
}
