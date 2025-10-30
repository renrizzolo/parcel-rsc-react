import type { PageProps } from "@parcel/rsc";
import "./Nav.css";
import { flatRoutes } from "../../routes";

export function Nav({ currentPage }: PageProps) {
  return (
    <nav>
      <h3>Navigation</h3>
      <p>
        <code>components/Nav.tsx</code> shows how to render a list of pages.
      </p>
      <ul>
        {flatRoutes.map((page) => (
          <li key={page.path}>
            <a
              href={page.path}
              aria-current={page.html === currentPage.url ? "page" : undefined}
            >
              {page.path}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
