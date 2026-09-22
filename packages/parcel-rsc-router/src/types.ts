import type { Page as ParcelPage, TocNode } from "@parcel/rsc";

export type { TocNode };

export namespace App {
  export interface Routes {}
}

export type RoutePath = keyof App.Routes extends never
  ? string
  : keyof App.Routes;

/**
 * Union of all valid HTML route paths, e.g. "/index.html" | "/components/button.html"
 */
export type RouteHtml = keyof App.Routes extends never
  ? `${string}.html`
  : App.Routes[keyof App.Routes]["html"];

export type RouteRsc = keyof App.Routes extends never
  ? `${string}.rsc`
  : App.Routes[keyof App.Routes]["rsc"];

export type RouteData = Omit<RouteNode, "children">;

type RoutePathToSlug<T extends string> = T extends `/`
  ? "index"
  : T extends `${infer _Prefix}/${infer Slug}`
    ? RoutePathToSlug<Slug>
    : T;

export interface RouteNode {
  children: RouteNode[];
  path: RoutePath;
  slug: RoutePathToSlug<RoutePath>;
  rsc: RouteRsc;
  html: RouteHtml;
}

/**
 * Enhanced Page interface where `url` is typed with generated HTML route URLs.
 */
export interface Page<TUrl extends string = RouteHtml> extends Omit<
  ParcelPage,
  "url"
> {
  url: TUrl;
}

/**
 * Enhanced PageProps where `pages` and `currentPage` have typed `url`s.
 *
 * - Default: allows any valid HTML route in the app.
 * - Narrowed: `PageProps<'/theme-builder.html'>` for specific page components.
 */
export interface PageProps<TUrl extends string = RouteHtml> {
  pages: Page<RouteHtml>[];
  currentPage: Page<TUrl>;
}
