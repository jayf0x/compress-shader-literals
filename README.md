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

Run against shaders shipped in real npm packages — measured by this plugin's own engine ([`tests/e2e.js`](tests/e2e.js)):

<!-- STATS:START -->

| Package               | Shaders |   Before |    After |    Saved |
| --------------------- | ------: | -------: | -------: | -------: |
| `@jayf0x/fluidity-js` |      10 | 60,898 B | 59,018 B | **3.1%** |
| **Total**             |      10 | 60,898 B | 59,018 B | **3.1%** |

_10 real shaders from 1 package(s), compressed by this plugin's engine._

<!-- STATS:END -->

These are already-published, already-built bundles (their own minifier ran first), so this is the **floor**. On raw source shaders — with comments and formatting intact — savings are far higher (the bundled demo shows **37.67%** on a single commented shader).

## How it works

1. Parses each matched file with Babel (TS/JSX aware).
2. Finds tagged and comment-prefixed shader literals (see [What it compresses](#what-it-compresses)).
3. Strips comments + collapses whitespace, rewriting via [`magic-string`](https://github.com/Rich-Harris/magic-string) so **sourcemaps stay intact**.
4. Runs as a `pre` transform, so your bundler's own minifier still sees the result.

## License

[MIT](./LICENSE) © jayF0x
