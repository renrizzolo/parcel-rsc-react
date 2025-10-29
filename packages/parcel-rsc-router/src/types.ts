export namespace App {
  export interface Routes extends Record<string, RouteData> {}
}

export type RoutePath = keyof App.Routes extends never
  ? string
  : keyof App.Routes extends string
    ? keyof App.Routes
    : string;

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
  rsc: RoutePathToFile<RoutePath, "rsc">;
  html: RoutePathToFile<RoutePath, "html">;
}

type RoutePathToFile<
  T extends string,
  Ext extends "rsc" | "html",
> = T extends `/` ? `/${"index"}.${Ext}` : `${T}.${Ext}`;
