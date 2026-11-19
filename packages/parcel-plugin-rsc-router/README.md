# @renr/parcel-plugin-rsc-router

A native Parcel v3 plugin (reporter + transformer) that scans RSC page files, generates typed filesystem route definitions on build, and statically prerenders HTML and RSC payloads.

Pair with [`@renr/parcel-rsc-router`](https://github.com/renrizzolo/parcel-rsc-react/tree/main/packages/parcel-rsc-router) for type-safe client-side navigation in Parcel static RSC applications.

## Installation

For the simplest setup, install [`@renr/parcel-config-rsc-router`](../parcel-config-rsc-router) (which depends on `@renr/parcel-plugin-rsc-router`):

```bash
pnpm add -D @renr/parcel-config-rsc-router
# or
npm install -D @renr/parcel-config-rsc-router
# or
yarn add -D @renr/parcel-config-rsc-router
```

Or install `@renr/parcel-plugin-rsc-router` directly if configuring `.parcelrc` manually:

```bash
pnpm add -D @renr/parcel-plugin-rsc-router
# or
npm install -D @renr/parcel-plugin-rsc-router
# or
yarn add -D @renr/parcel-plugin-rsc-router
```

## Setup

### 1. Configure `.parcelrc`

**Recommended** (using `@renr/parcel-config-rsc-router`):

```json
{
  "extends": "@renr/parcel-config-rsc-router"
}
```

**Manual `.parcelrc` setup** (register `@renr/parcel-plugin-rsc-router` in both `transformers` for `routes.ts` and `reporters`):

```json
{
  "extends": "@parcel/config-default",
  "transformers": {
    "routes.ts": ["@renr/parcel-plugin-rsc-router", "..."]
  },
  "reporters": ["...", "@renr/parcel-plugin-rsc-router"]
}
```

Why both? Parcel `.parcelrc` lists plugins by the pipeline stage they participate in. Inside one native package, `@renr/parcel-plugin-rsc-router` handles three distinct phases:

1. **`build_start` (Reporter)**: scans `src/pages/**/*` and writes the clean, typed `routes.ts` to disk before bundling.
2. **`transform` on `routes.ts` (Transformer)**: runs **only** in the `ReactServer` environment to append an in-memory `prerenderStaticSite` + dynamic `await import(...)` bootstrap footer, leaving `routes.ts` clean on disk and untouched for `ReactClient` imports.
3. **`build_success` (Reporter)**: runs the built `ReactServer` `routes.js` bundle with `PARCEL_RSC_PRERENDER=1` to write static `.html` and `.rsc` files to your target `distDir`.

### 2. Configure `package.json`

Point Parcel's `source` at your generated `routes.ts` entrypoint with a `react-server` target, and configure `@renr/parcel-plugin-rsc-router`:

```json
{
  "source": "routes.ts",
  "@renr/parcel-plugin-rsc-router": {
    "source": "src/pages/**/*.{tsx,mdx}"
  },
  "targets": {
    "default": {
      "context": "react-server",
      "distDir": "dist"
    }
  }
}
```

> Note: Parcel 3 resolves `package.json#source` (`"routes.ts"`) before plugin hooks run, so `routes.ts` should already exist on disk before `parcel build` (committed to the repo, or generated once on a clean checkout with `npx parcel-rsc-routes`).

#### Output Configuration

- **Built site & prerendered `.html`/`.rsc` output directory**: set Parcel's `targets.default.distDir` in `package.json` (defaults to `dist`).
- **Generated `routes.ts` output path**: set `"output"` under `@renr/parcel-plugin-rsc-router` (defaults to `routes.ts`). Passing a directory such as `"src"` automatically appends `routes.ts` (`src/routes.ts`).

Whenever you change `"output"`, **you must also update `package.json#source`** (Parcel's entrypoint) and any app imports (such as `flatRoutes` or `routeTree`) to point at the generated file:

```json
{
  "source": "src/routes.ts",
  "@renr/parcel-plugin-rsc-router": {
    "source": "src/pages/**/*.{tsx,mdx}",
    "output": "src/routes.ts"
  },
  "targets": {
    "default": {
      "context": "react-server",
      "distDir": "dist"
    }
  }
}
```

Because Parcel matches `"routes.ts"` in `.parcelrc` against file basenames, keeping the filename `routes.ts` (for example `"output": "src/routes.ts"` or `"output": "src"`) works automatically with `@renr/parcel-config-rsc-router`.

If you use a filename other than `routes.ts` (such as `"output": "routes/index.ts"`), also update `package.json#source` and add a matching glob in `.parcelrc#transformers`:

`.parcelrc`:

```json
{
  "extends": "@renr/parcel-config-rsc-router",
  "transformers": {
    "routes/index.ts": ["@renr/parcel-plugin-rsc-router", "..."]
  }
}
```

`package.json`:

```json
{
  "source": "routes/index.ts",
  "@renr/parcel-plugin-rsc-router": {
    "source": "src/pages/**/*.{tsx,mdx}",
    "output": "routes/index.ts"
  },
  "targets": {
    "default": {
      "context": "react-server",
      "distDir": "dist"
    }
  }
}
```

## What It Generates

On each build and during watch mode, the native plugin scans your page files and produces:

1. **`flatRoutes`**: A flat array of all route definitions conforming to `RouteData[]`.
2. **`routeTree`**: A nested tree structure with parent-child relationships and `children` arrays (`RouteNode`).
3. **`routesByPage`**: A typed lookup dictionary mapping HTML file paths to their route objects.
4. **TypeScript Module Augmentation**: Augments `App.Routes` in `@renr/parcel-rsc-router` so all paths passed to `<Link to="...">` and `useRouter().navigate(...)` are strictly type-checked.
5. **Static Prerendered Output**: Writes `.html` and `.rsc` files for every route into your target `distDir` after bundling succeeds (using `oxfmt` in the standalone `parcel-rsc-routes` CLI / `generateRoutes` API, and native Rust formatting in Parcel builds).

## License

MIT
