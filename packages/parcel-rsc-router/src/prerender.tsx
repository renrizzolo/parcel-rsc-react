import fs from "node:fs/promises";
import path from "node:path";
import type { ComponentType } from "react";
import { renderHTML, renderRSC } from "@parcel/rsc/server";
import type { Page, PageProps, RouteData, TocNode } from "./types.js";

export interface PrerenderPageModule {
  default: ComponentType<PageProps>;
  tableOfContents?: TocNode[];
  [key: string]: unknown;
}

export interface PrerenderOptions {
  routes: RouteData[];
  pages: Record<string, PrerenderPageModule>;
  bootstrapComponent?: ComponentType;
  outDir?: string;
  staticDir?: string;
}

function hasBootstrapScript(
  value: unknown
): value is ComponentType & { bootstrapScript: string } {
  return (
    typeof value === "function" &&
    typeof (value as { bootstrapScript?: unknown }).bootstrapScript ===
      "string" &&
    Boolean((value as { bootstrapScript?: string }).bootstrapScript)
  );
}

function findBootstrapInElement(
  node: unknown,
  depth = 0
): ComponentType | undefined {
  if (depth > 5 || !node || typeof node !== "object") {
    return undefined;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findBootstrapInElement(child, depth + 1);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  const maybeElement = node as {
    type?: unknown;
    props?: { children?: unknown };
  };
  if (hasBootstrapScript(maybeElement.type)) {
    return maybeElement.type;
  }

  if (maybeElement.props && "children" in maybeElement.props) {
    return findBootstrapInElement(maybeElement.props.children, depth + 1);
  }

  return undefined;
}

function resolveBootstrapComponent(
  PageComponent: ComponentType<PageProps>,
  props: PageProps
): ComponentType | undefined {
  if (hasBootstrapScript(PageComponent)) {
    return PageComponent as unknown as ComponentType;
  }

  // Avoid invoking async server components outside React's render lifecycle.
  if (PageComponent.constructor?.name === "AsyncFunction") {
    return undefined;
  }

  try {
    const rendered = (PageComponent as (p: PageProps) => unknown)(props);
    if (
      rendered &&
      typeof rendered === "object" &&
      "then" in rendered &&
      typeof (rendered as { then?: unknown }).then === "function"
    ) {
      (rendered as Promise<unknown>).catch(() => {});
      return undefined;
    }
    return findBootstrapInElement(rendered);
  } catch {
    return undefined;
  }
}

export async function prerenderStaticSite({
  routes,
  pages,
  bootstrapComponent,
  outDir = process.env.PARCEL_RSC_OUT_DIR
    ? path.resolve(process.env.PARCEL_RSC_OUT_DIR)
    : path.resolve(process.cwd(), "dist"),
  staticDir = path.resolve(process.cwd(), "static"),
}: PrerenderOptions): Promise<void> {
  await fs.mkdir(outDir, { recursive: true });

  try {
    await fs.cp(staticDir, outDir, { recursive: true });
  } catch {
    // ignore if staticDir doesn't exist
  }

  const allPages: Page[] = routes.map((route) => {
    const mod = pages[route.html];
    const { default: _default, tableOfContents, ...exports } = mod ?? {};
    return {
      url: route.html,
      name: route.slug,
      exports,
      tableOfContents,
    };
  });

  let fallbackBootstrap: ComponentType | undefined =
    bootstrapComponent ??
    (Object.values(pages).find((mod) => hasBootstrapScript(mod?.default))
      ?.default as ComponentType | undefined);

  // If no page module carries bootstrapScript directly (e.g. an MDX-only site where
  // `'use server-entry'` lives on the layout component wrapped by each `.mdx` file),
  // probe the first page wrapper to discover the layout's bootstrapScript.
  if (!fallbackBootstrap) {
    for (const route of routes) {
      const mod = pages[route.html];
      if (!mod?.default) continue;
      const { default: PageComponent, tableOfContents, ...exports } = mod;
      const resolved = resolveBootstrapComponent(PageComponent, {
        pages: allPages,
        currentPage: {
          url: route.html,
          name: route.slug,
          exports,
          tableOfContents,
        },
      });
      if (resolved) {
        fallbackBootstrap = resolved;
        break;
      }
    }
  }

  for (const route of routes) {
    const mod = pages[route.html];
    if (!mod?.default) continue;

    const { default: PageComponent, tableOfContents, ...exports } = mod;
    const currentPage: PageProps["currentPage"] = {
      url: route.html,
      name: route.slug,
      exports,
      tableOfContents,
    };

    const pageProps: PageProps = {
      pages: allPages,
      currentPage,
    };

    const element = <PageComponent {...pageProps} />;

    const componentWithBootstrap =
      resolveBootstrapComponent(PageComponent, pageProps) ?? fallbackBootstrap;

    const htmlStream = await renderHTML(element, {
      component: componentWithBootstrap,
    });
    const html = await new Response(htmlStream).text();

    const rscStream = renderRSC(element);
    const rsc = await new Response(rscStream).text();

    const htmlFilePath = path.join(outDir, route.html.slice(1));
    const rscFilePath = path.join(outDir, route.rsc.slice(1));

    await fs.mkdir(path.dirname(htmlFilePath), { recursive: true });
    await fs.writeFile(htmlFilePath, html, "utf-8");
    await fs.writeFile(rscFilePath, rsc, "utf-8");
  }
}
