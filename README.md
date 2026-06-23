# compress-shader-literals

Local Vite plugin that minifies GLSL and WGSL shader strings at build time.

Strips block comments, line comments, and redundant whitespace from shader template literals. Runs as a `pre` transform so the result feeds into esbuild minification.

## Usage

```js
// vite.config.js
import { compressShaderLiterals } from './compress-shader-literals/plugin.js';

export default {
  plugins: [compressShaderLiterals.vite({ outputRatio: true })],
};
```

## Options

| Option        | Default                      | Description                    |
| ------------- | ---------------------------- | ------------------------------ |
| `tags`        | `['glsl', 'wgsl', 'shader']` | Tag names to match             |
| `include`     | `/\.[jt]sx?$/`               | Files to process               |
| `exclude`     | `/node_modules/`, `/dist/`   | Files to skip                  |
| `outputRatio` | `false`                      | Print size summary after build |

## Supported syntax

```ts
// Tagged template literal
const vert = wgsl`void main() { ... }`;

// Comment-prefixed template literal
const frag = /* glsl */ `void main() { ... }`;
```

## Test

```sh
node compress-shader-literals/run-test.js
```

Runs the transform against `src/core/shaders.ts` and prints bytes saved.
