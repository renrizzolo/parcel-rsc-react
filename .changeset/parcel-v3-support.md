---
"@renr/parcel-rsc-router": minor
"@renr/parcel-plugin-rsc-router": major
"@renr/parcel-config-rsc-router": minor
"@renr/parcel-reporter-docgen": minor
---

Add Parcel v3 support with native Rust plugins and static RSC prerendering:

- **@renr/parcel-plugin-rsc-router**: Native Rust Parcel v3 transformer and reporter plugin (replacing `@renr/parcel-reporter-rsc-router`) that generates typed filesystem routes, injects the server-side prerender footer (using JS-compatible `Reflect.get`/`Reflect.set`), tracks page path changes without redundant mtime-driven rewrites, and hashes built bundles to skip unchanged prerenders.
- **@renr/parcel-config-rsc-router**: Shared Parcel v3 `.parcelrc` config wiring `@renr/parcel-plugin-rsc-router`.
- **@renr/parcel-rsc-router**: Add `@renr/parcel-rsc-router/prerender` (`prerenderStaticSite`) for Parcel v3 static HTML/RSC generation, resolve and cache `bootstrapScript` from wrapped layout components (e.g. compiled MDX pages) without invoking async pages outside React, and update `@parcel/rsc` peer dependency to `^3.0.0-alpha.3`.
- **@renr/parcel-reporter-docgen**: Migrate to a native Rust Parcel v3 reporter backed by the Node docgen CLI.
