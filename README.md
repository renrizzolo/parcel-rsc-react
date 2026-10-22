# parcel-rsc-react

A modular toolkit for building React Server Components (RSC) applications with [Parcel](https://parceljs.org/recipes/rsc/#static-rendering).

## Packages

| Package                                                                     | Description                                                                                                                                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`@renr/parcel-rsc-router`](./packages/parcel-rsc-router)                   | Client-side router designed for Parcel static RSC applications, featuring declarative & programmatic navigation, type safety, prefetching, and scroll restoration. |
| [`@renr/parcel-reporter-rsc-router`](./packages/parcel-reporter-rsc-router) | Parcel reporter that scans RSC pages and generates typed filesystem route definitions, tree structures, and module augmentations.                                  |
| [`@renr/parcel-reporter-docgen`](./packages/parcel-reporter-docgen)         | Parcel reporter that extracts UI component documentation and prop types as JSON using `react-docgen-typescript`.                                                   |

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
