# @renr/parcel-reporter-rsc-router

A Parcel reporter plugin that scans static RSC page files and generates typed filesystem route definitions on build.

Pair with [`@renr/parcel-rsc-router`](https://github.com/renrizzolo/parcel-rsc-react/tree/main/packages/parcel-rsc-router) for type-safe client-side navigation in Parcel static RSC applications.

## Installation

```bash
pnpm add -D @renr/parcel-reporter-rsc-router
# or
npm install -D @renr/parcel-reporter-rsc-router
# or
yarn add -D @renr/parcel-reporter-rsc-router
```

## Setup

### 1. Add to `.parcelrc`

Add `@renr/parcel-reporter-rsc-router` to your `.parcelrc` reporters list:

```json
{
  "extends": "@parcel/config-default",
  "reporters": ["...", "@renr/parcel-reporter-rsc-router"]
}
```

### 2. Configure in `package.json`

Define the `react-static` target with your pages glob in your app's `package.json`:

```json
{
  "targets": {
    "react-static": {
      "source": "src/pages/**/*.{tsx,mdx}",
      "context": "react-server"
    }
  }
}
```

#### Optional: Custom Output Path

By default, routes are generated at `<projectRoot>/routes.ts`. You can customize the output location in `package.json`:

```json
{
  "@renr/parcel-reporter-rsc-router": {
    "output": "src/routes.ts"
  }
}
```

## What It Generates

On each build and during watch mode, the reporter scans your page files and produces:

1. **`flatRoutes`**: A flat array of all route definitions conforming to `RouteData[]`.
2. **`routeTree`**: A nested tree structure with parent-child relationships and `children` arrays (`RouteNode`).
3. **`routesByPage`**: A typed lookup dictionary mapping HTML file paths to their route objects.
4. **TypeScript Module Augmentation**: Augments `App.Routes` in `@renr/parcel-rsc-router` so all paths passed to `<Link to="...">` and `useRouter().navigate(...)` are strictly type-checked.
5. **Prettier Formatting**: Automatically resolves and applies your project's Prettier configuration.

## License

MIT
