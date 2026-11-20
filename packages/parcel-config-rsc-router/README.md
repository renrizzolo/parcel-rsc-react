# @renr/parcel-config-rsc-router

Shared Parcel v3 configuration preset that wires up [`@renr/parcel-plugin-rsc-router`](../parcel-plugin-rsc-router) across Parcel's `transformers` and `reporters` pipelines.

## Installation

```bash
pnpm add -D @renr/parcel-config-rsc-router
# or
npm install -D @renr/parcel-config-rsc-router
# or
yarn add -D @renr/parcel-config-rsc-router
```

## Usage

### 1. `.parcelrc`

```json
{
  "extends": "@renr/parcel-config-rsc-router"
}
```

### 2. `package.json`

Configure your generated `routes.ts` entrypoint, target output directory, and pages glob:

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

### Custom Routes File Path

To write the generated routes file to a custom location (for example `src/routes.ts`, or a directory like `"src"` which appends `routes.ts`), set `"output"` and **update `package.json#source`** (along with any imports in your app) to match:

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

Because Parcel matches `"routes.ts"` in `@renr/parcel-config-rsc-router` against file basenames, any `*/routes.ts` path works without modifying `.parcelrc`.

If you rename the generated file to something other than `routes.ts` (for example `"output": "routes/index.ts"`), update `package.json#source` to `"routes/index.ts"` and add a `transformers` entry in `.parcelrc`:

```json
{
  "extends": "@renr/parcel-config-rsc-router",
  "transformers": {
    "routes/index.ts": ["@renr/parcel-plugin-rsc-router", "..."]
  }
}
```

## License

MIT
