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

  const fallbackBootstrap =
    bootstrapComponent ??
    (Object.values(pages).find((mod) =>
      Boolean((mod?.default as { bootstrapScript?: string })?.bootstrapScript)
    )?.default as ComponentType | undefined);

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

    const element = (
      <PageComponent pages={allPages} currentPage={currentPage} />
    );

    const componentWithBootstrap = (
      PageComponent as { bootstrapScript?: string }
    ).bootstrapScript
      ? (PageComponent as unknown as ComponentType)
      : fallbackBootstrap;

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
