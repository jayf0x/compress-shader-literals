# compress-shader-literals

> **Size matters.** Strip everything strippable from your GLSL & WGSL shaders at build time.

> ⭐ Star this repository to support development and help others discover it.

[![npm version](https://img.shields.io/npm/v/compress-shader-literals?color=cb3837&logo=npm)](https://www.npmjs.com/package/compress-shader-literals)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/compress-shader-literals?color=success)](https://bundlephobia.com/package/compress-shader-literals)
[![npm downloads](https://img.shields.io/npm/dm/compress-shader-literals?color=success)](https://www.npmjs.com/package/compress-shader-literals)
[![license](https://img.shields.io/npm/l/compress-shader-literals?color=blue)](./LICENSE)

A build-time minifier that strips comments and whitespace from GLSL & WGSL shaders written as template literals in your JS/TS — in any bundler, with no renaming, no toolchain, and no runtime cost.

![Alt Preview](./assets/preview.png)

## Install

```sh
bun add -d compress-shader-literals
# or: npm i -D compress-shader-literals
```

## About

Shader comments and indentation are dead weight in the bundle — the GPU ignores them, the browser still downloads them. This strips them at build time.

- Removes comments, collapses whitespace. Nothing else.
- No renaming, no dead-code removal — output stays valid and readable.
- Runs before your bundler's own minifier.

## Usage

One [unplugin](https://github.com/unjs/unplugin) plugin, same API for every bundler:

```js
import { compressShaderLiterals } from 'compress-shader-literals';

// vite.config.js
export default { plugins: [compressShaderLiterals.vite({ outputRatio: true })] };
```

For Rollup, webpack, esbuild, Rspack, Rolldown or Farm, call the matching method — `.rollup()`, `.webpack()`, `.esbuild()`, `.rspack()`, `.rolldown()`, `.farm()` — with the same options.

Finds tagged and comment-prefixed literals. The comment form keeps editor syntax highlighting:

```ts
const vert = glsl`
  // vertex shader  ← stripped
  precision highp float;
  void main() { gl_Position = vec4(0.0); }
`;

const frag = /* wgsl */ `
  /* fragment */
  fn main() {}
`;
```

**Options**

| Option        | Default                      | Description                                         |
| ------------- | ---------------------------- | --------------------------------------------------- |
| `tags`        | `['glsl', 'wgsl', 'shader']` | Tag names / comment markers to match                |
| `include`     | `[/\.[mc]?[jt]sx?$/]`        | Files to process — the JS/TS family Babel can parse |
| `exclude`     | `[/node_modules/, /dist/]`   | Files to skip — dependencies are skipped by default |
| `outputRatio` | `false`                      | Print a bytes-saved summary after build             |
| `transform`   | built-in `minifyShader`      | Custom minifier — `(shader: string) => string`      |
| `debug`       | `false`                      | Log each file's discovered literals to the console  |

**Programmatic API** — the two core helpers are exported for tooling authors (validators, ESLint rules, CLIs), no plugin required:

```js
import { extractShaderLiterals, minifyShader } from 'compress-shader-literals';

extractShaderLiterals('const v = glsl`void main() {}`');
// → [{ tag: 'glsl', value: 'void main() {}', start: 10, end: 26 }]

minifyShader('// comment\nvoid  main() {}'); // → 'void main() {}'
```

## Stats

Real shaders shipped by popular libraries, run through the built-in minifier:

<!-- STATS:START -->

| Package            | Shaders |    Before |     After |     Saved |
| ------------------ | ------: | --------: | --------: | --------: |
| `three`            |     281 | 240,772 B | 203,428 B | **15.5%** |
| `ogl`              |      22 |   6,109 B |   5,335 B | **12.7%** |
| `shader-park-core` |      18 |  10,794 B |   9,033 B | **16.3%** |
| `curtainsjs`       |       7 |   3,406 B |   2,563 B | **24.8%** |
| **Total**          |     328 | 261,081 B | 220,359 B | **15.6%** |

_328 shaders · 303/303 parseable GLSL verified valid after minify · [how this is measured](docs/stats.md) · 2026-06-29_

<!-- STATS:END -->

## How it works

1. Parses each matched file with Babel — `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts`, `.cts` (not `.vue`/`.svelte`/`.glsl`, which aren't whole-file JS).
2. Finds tagged (`` glsl`…` ``) and comment-prefixed (`/* glsl */ \`…\``) literals, skipping any with `${…}` interpolation.
3. Strips comments and collapses each run of whitespace to a single space or newline — never to nothing, so adjacent tokens stay separated and `#version`/`#define` lines survive.
4. Rewrites the literal in place with [magic-string](https://github.com/Rich-Harris/magic-string), so sourcemaps stay intact.
5. Runs as a `pre` transform, so your bundler's own minifier still sees the result.

## Issues & compatibility

If you run into any problems — wrong output, a shader pattern that isn't picked up, or a library that doesn't play nicely — please [open an issue](https://github.com/jayf0x/compress-shader-literals/issues) or just mention which library you're using and I'll add it to the test suite.

## License

[MIT](./LICENSE) © [jayF0x](https://github.com/jayf0x)
