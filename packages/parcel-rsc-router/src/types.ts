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

export type RouteData<
  TPath extends string = RoutePath,
  THtml extends string = RouteHtml,
  TRsc extends string = RouteRsc,
> = Omit<RouteNode<TPath, THtml, TRsc>, "children">;

type RoutePathToSlug<T extends string> = T extends `/`
  ? "index"
  : T extends `${infer _Prefix}/${infer Slug}`
    ? RoutePathToSlug<Slug>
    : T;

export interface RouteNode<
  TPath extends string = RoutePath,
  THtml extends string = RouteHtml,
  TRsc extends string = RouteRsc,
> {
  children: RouteNode<TPath, THtml, TRsc>[];
  path: TPath;
  slug: RoutePathToSlug<TPath>;
  rsc: TRsc;
  html: THtml;
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
 */
export interface PageProps<TUrl extends string = RouteHtml> {
  pages: Page<RouteHtml>[];
  currentPage: Page<TUrl>;
}
