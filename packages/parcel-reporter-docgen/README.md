# @renr/parcel-reporter-docgen

A Parcel reporter plugin that extracts UI component documentation and prop types as JSON using `react-docgen-typescript`.

## Features

- **Automated Prop Extraction**: Parses component props, types, descriptions, default values, and required status.
- **Compound Component Support**: Handles dot-notation subcomponents (`Dialog.Title`) and `Object.assign` assignment patterns (`Object.assign(Base, { Sub })`).
- **Incremental Caching**: Tracks file modification times (`mtime`) to only reparse changed components in watch mode.
- **Configurable TSConfig**: Supports custom `tsconfig.json` paths for complex workspaces.

## Installation

```bash
pnpm add -D @renr/parcel-reporter-docgen
# or
npm install -D @renr/parcel-reporter-docgen
# or
yarn add -D @renr/parcel-reporter-docgen
```

## Setup

### 1. Add to `.parcelrc`

Add `@renr/parcel-reporter-docgen` to your `.parcelrc` reporters:

```json
{
  "extends": "@parcel/config-default",
  "reporters": ["...", "@renr/parcel-reporter-docgen"]
}
```

### 2. Configure in `package.json`

Add the `@renr/parcel-reporter-docgen` configuration object to your `package.json`:

```json
{
  "@renr/parcel-reporter-docgen": {
    "source": "src/components/**/*.{ts,tsx}",
    "output": "docs/components",
    "tsconfig": "./tsconfig.json"
  }
}
```

### Options

| Option     | Type     | Required | Default             | Description                                                           |
| ---------- | -------- | -------- | ------------------- | --------------------------------------------------------------------- |
| `source`   | `string` | **Yes**  | -                   | Glob pattern for component source files                               |
| `output`   | `string` | No       | `"docgen"`          | Directory where JSON documentation files will be saved                |
| `tsconfig` | `string` | No       | `"./tsconfig.json"` | Relative path to the TypeScript config file to use for docgen parsing |

## Output Format

For each component, a JSON file `<ComponentName>.json` is generated:

```json
{
  "name": "Counter",
  "description": "A counter client component with custom starting value.",
  "path": "src/components/Counter.tsx",
  "fileName": "Counter.tsx",
  "props": {
    "initialCount": {
      "name": "initialCount",
      "required": false,
      "type": { "name": "number | undefined" },
      "defaultValue": { "value": "0" },
      "description": "Initial number to start counting from.",
      "shortPropTypeName": "number"
    }
  },
  "subcomponents": {
    "Button": {
      "name": "Counter.Button",
      "props": { ... }
    }
  }
}
```

## License

MIT
