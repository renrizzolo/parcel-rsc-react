---
"@renr/parcel-plugin-rsc-router": major
---

Introduce native Rust Parcel v3 transformer and reporter plugin (replacing `@renr/parcel-reporter-rsc-router`) that generates typed filesystem routes, injects the server-side prerender footer (using JS-compatible `Reflect.get`/`Reflect.set`), tracks page path changes without redundant mtime-driven rewrites, and hashes built bundles to skip unchanged prerenders.
