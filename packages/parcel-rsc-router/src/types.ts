export namespace App {
  export interface Routes extends Record<string, RouteData> {}
}

// narrow the interface to have string keys only
export type RoutePath = Exclude<keyof App.Routes, number>;

export type RouteData = Omit<RouteNode, "children">;

type RoutePathToSlug<T extends string> = T extends `/`
  ? "root"
  : T extends `${infer _Prefix}/${infer Slug}`
    ? RoutePathToSlug<Slug>
    : T;

export interface RouteNode {
  children: RouteNode[];
  path: RoutePath;
  slug: RoutePathToSlug<RoutePath>;
  rsc: `${string}.rsc`;
  html: `${string}.html`;
}
