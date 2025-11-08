export namespace App {
  export interface Routes {}
}

export type RoutePath = keyof App.Routes extends never
  ? string
  : keyof App.Routes;

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
  rsc: `${string}.rsc`;
  html: `${string}.html`;
}
