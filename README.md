# parcel-rsc-react

A router and set of plugins for building static sites using React Server Components (RSC) with [Parcel V3](https://v3.parceljs.org/recipes/rsc/). 

For Parcel 2, see the https://github.com/renrizzolo/parcel-rsc-react/tree/parcel-v2 branch.


➡️ See it in use at https://cumulo-ui.netlify.app

---

**⚠️ This is in beta: APIs may change and break, and features may not work as expected.**


## Packages

| Package                                                                 | Description                                                                                                                                                        |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`@renr/parcel-rsc-router`](./packages/parcel-rsc-router)               | Client-side router designed for Parcel static RSC applications, featuring declarative & programmatic navigation, type safety, prefetching, and scroll restoration. |
| [`@renr/parcel-plugin-rsc-router`](./packages/parcel-plugin-rsc-router) | Native Parcel v3 plugin that scans RSC pages, generates typed filesystem route definitions and module augmentations, and statically prerenders HTML/RSC output.    |
| [`@renr/parcel-config-rsc-router`](./packages/parcel-config-rsc-router) | Shared Parcel v3 configuration preset that wires up `@renr/parcel-plugin-rsc-router`.                                                                              |
| [`@renr/parcel-reporter-docgen`](./packages/parcel-reporter-docgen)     | Parcel reporter that extracts UI component documentation and prop types as JSON using `react-docgen-typescript`.                                                   |

## Apps & Examples

- [`apps/my-static-site`](./apps/my-static-site): An example static React Server Component application built with Parcel, showcasing filesystem routing, client components, syntax highlighting with Shiki, and docgen integration.

## Development

```bash
# Install dependencies
pnpm install

# Run dev mode across packages and apps
pnpm run dev

# Run type-checking
pnpm run type-check

# Run linter
pnpm run lint

# Run test suite
pnpm run test:ci

# Build all packages and apps
pnpm run build
```

## License

MIT
