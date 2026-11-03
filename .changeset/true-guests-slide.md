---
"@renr/parcel-reporter-rsc-router": minor
"@renr/parcel-reporter-docgen": minor
---

- Switch code formatting to oxfmt
- Add watch-mode file mtime caching in `generateRoutes`
- Only log route summary with page count when routes are written
- Avoid running code formatting unconditionally
- Check `process.cwd()` package.json first for `react-static` target before falling back to `options.projectRoot`
