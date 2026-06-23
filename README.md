# compress-shader-literals

> **Size matters.** Minify your GLSL & WGSL shader strings at build time — automatically, in any bundler.

[![npm version](https://img.shields.io/npm/v/compress-shader-literals?color=cb3837&logo=npm)](https://www.npmjs.com/package/compress-shader-literals)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/compress-shader-literals?color=success)](https://bundlephobia.com/package/compress-shader-literals)
[![npm downloads](https://img.shields.io/npm/dm/compress-shader-literals?color=success)](https://www.npmjs.com/package/compress-shader-literals)
[![license](https://img.shields.io/npm/l/compress-shader-literals?color=blue)](./LICENSE)

Your shaders ship with every comment, indent, and blank line you wrote them with. This strips all of it — block comments, line comments, redundant whitespace — from `glsl` / `wgsl` template literals, **before** your bundler minifies the rest. Smaller bundles, zero source changes, full sourcemaps.

Built on [unplugin](https://github.com/unjs/unplugin), so it runs in **Vite, Rollup, webpack, esbuild, Rspack, Rolldown & Farm** from one package.

## Install

```sh
npm i -D compress-shader-literals
# or: bun add -d compress-shader-literals
```

## Usage

Pick your bundler — same plugin, same options:

```js
import { compressShaderLiterals } from 'compress-shader-literals';

// Vite        vite.config.js
export default { plugins: [compressShaderLiterals.vite({ outputRatio: true })] };

// Rollup      rollup.config.js   →  compressShaderLiterals.rollup({ ... })
// webpack     webpack.config.js  →  compressShaderLiterals.webpack({ ... })
// esbuild     build script       →  compressShaderLiterals.esbuild({ ... })
// Rspack / Rolldown / Farm       →  .rspack() / .rolldown() / .farm()
```

That's it. Shaders are compressed on the way through; everything else is untouched.

## What it compresses

```ts
// Tagged template literal
const vert = glsl`
  // vertex shader  ← stripped
  precision highp float;
  void main() { gl_Position = vec4(0.0); }
`;

// Comment-prefixed template literal (great for editor syntax highlighting)
const frag = /* wgsl */ `
  /* fragment */
  fn main() {}
`;
```

→ both become a single tight line, no comments, no padding.

## Options

| Option        | Default                      | Description                             |
| ------------- | ---------------------------- | --------------------------------------- |
| `tags`        | `['glsl', 'wgsl', 'shader']` | Tag names / comment markers to match    |
| `include`     | `[/\.[jt]sx?$/]`             | Files to process                        |
| `exclude`     | `[/node_modules/, /dist/]`   | Files to skip                           |
| `outputRatio` | `false`                      | Print a bytes-saved summary after build |

With `outputRatio: true`:

```
compress-shader-literals
────────────────────────
215.00 B → 134.00 B
saved: 81.00 B (37.67% smaller)
shaders: 1
```

## Real-world stats

Run against the actual shaders shipped in **[three.js](https://www.npmjs.com/package/three)**, **[ogl](https://www.npmjs.com/package/ogl)**, **[shader-park-core](https://www.npmjs.com/package/shader-park-core)**, **[curtains.js](https://www.npmjs.com/package/curtainsjs)** and more — measured by this plugin's own engine ([`tests/e2e.js`](tests/e2e.js)):

<!-- STATS:START -->

| Package               | Shaders |    Before |     After |     Saved |
| --------------------- | ------: | --------: | --------: | --------: |
| `three`               |     281 | 240,772 B | 203,428 B | **15.5%** |
| `@jayf0x/fluidity-js` |       9 |   9,524 B |   7,133 B | **25.1%** |
| `ogl`                 |      22 |   6,109 B |   5,335 B | **12.7%** |
| `shader-park-core`    |      18 |  10,794 B |   9,033 B | **16.3%** |
| `curtainsjs`          |       7 |   3,406 B |   2,563 B | **24.8%** |
| **Total**             |     337 | 270,605 B | 227,492 B | **15.9%** |

_337 real shaders from 5 package(s), compressed by this plugin's engine._

<!-- STATS:END -->

Free bytes off code you already ship — no source changes. Marginal per shader, but it compounds across every shader in every bundle, and at infra scale even 1% is worth shipping.

## How it works

1. Parses each matched file with Babel (TS/JSX aware).
2. Finds tagged and comment-prefixed shader literals (see [What it compresses](#what-it-compresses)).
3. Strips comments + collapses whitespace, rewriting via [`magic-string`](https://github.com/Rich-Harris/magic-string) so **sourcemaps stay intact**.
4. Runs as a `pre` transform, so your bundler's own minifier still sees the result.

## License

[MIT](./LICENSE) © jayF0x
