# compress-shader-literals

> **Size matters.** Strip everything strippable from your GLSL & WGSL shaders at build time.

> ⭐ Star this repository to support development and help others discover it.

[![npm version](https://img.shields.io/npm/v/compress-shader-literals?color=cb3837&logo=npm)](https://www.npmjs.com/package/compress-shader-literals)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/compress-shader-literals?color=success)](https://bundlephobia.com/package/compress-shader-literals)
[![npm downloads](https://img.shields.io/npm/dm/compress-shader-literals?color=success)](https://www.npmjs.com/package/compress-shader-literals)
[![license](https://img.shields.io/npm/l/compress-shader-literals?color=blue)](./LICENSE)

A tiny build-time minifier for GLSL & WGSL shaders written as template literals in your JS/TS. Strips comments + whitespace — any bundler, no renaming, no toolchain, no runtime cost.

![Alt Preview](./assets/preview.gif)

## Install

[![NPM](https://nodei.co/npm/compress-shader-literals.png)](https://www.npmjs.com/package/compress-shader-literals)

```sh
bun add -d compress-shader-literals
```

## About

- Removes comments, collapses whitespace, joins statements, and trims space around delimiters. Whitespace and comments only.
- No renaming, no dead-code removal, no operator-space removal — output stays valid.
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

| Package                       | Shaders |      Before |       After |     Saved | Net after Brotli |
| ----------------------------- | ------: | ----------: | ----------: | --------: | ---------------: |
| `vtk.js`                      |     142 |   276,617 B |   159,634 B | **42.3%** |           +39.6% |
| `three-stdlib`                |     370 |   429,350 B |   272,486 B | **36.5%** |           +35.5% |
| `curtainsjs`                  |       7 |     3,406 B |     2,352 B | **30.9%** |           +10.1% |
| `hydra-synth`                 |      15 |     3,852 B |     2,675 B | **30.6%** |           +19.4% |
| `cesium`                      |     546 |   951,897 B |   664,581 B | **30.2%** |           +32.6% |
| `troika-three-utils`          |       4 |       168 B |       120 B | **28.6%** |                — |
| `pixi.js`                     |     162 |    75,768 B |    56,152 B | **25.9%** |                — |
| `shader-park-core`            |      18 |    10,794 B |     8,007 B | **25.8%** |                — |
| `@luma.gl/shadertools`        |      24 |   149,192 B |   111,095 B | **25.5%** |                — |
| `three`                       |     281 |   240,906 B |   185,520 B | **23.0%** |                — |
| `playcanvas`                  |     856 | 1,297,844 B | 1,039,365 B | **19.9%** |                — |
| `ogl`                         |      22 |     6,109 B |     4,925 B | **19.4%** |                — |
| `deck.gl`                     |     132 |   242,113 B |   198,706 B | **17.9%** |                — |
| `@paper-design/shaders`       |      30 |   142,466 B |   122,036 B | **14.3%** |                — |
| `@deck.gl/layers`             |     104 |   223,902 B |   195,827 B | **12.5%** |                — |
| `@deck.gl/core`               |      40 |    17,746 B |    15,738 B | **11.3%** |                — |
| `@deck.gl/aggregation-layers` |      56 |    43,713 B |    39,094 B | **10.6%** |                — |
| `@luma.gl/engine`             |      29 |    11,357 B |    10,384 B |  **8.6%** |                — |
| `@babylonjs/core`             |     349 |   669,740 B |   661,013 B |  **1.3%** |                — |
| `postprocessing`              |     136 |   179,705 B |   179,705 B |  **0.0%** |                — |
| **Total**                     |    3323 | 4,976,645 B | 3,929,415 B | **21.0%** |                — |

_3323 shaders · 2477/3323 parseable shaders (GLSL + WGSL) verified valid after minify · [how this is measured](docs/stats.md) · 2026-07-09_

<!-- STATS:END -->

## How it works

1. Parses each matched file with Babel — `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts`, `.cts` (not `.vue`/`.svelte`/`.glsl`, which aren't whole-file JS).
2. Finds tagged (`` glsl`…` ``) and comment-prefixed (`/* glsl */ \`…\``) literals, skipping any with `${…}` interpolation.
3. Strips comments, collapses whitespace, and joins statements onto one line — keeping real newlines around `#` preprocessor directives and `\` line-continuations (which are newline-sensitive). Whitespace hugging a delimiter (`( ) { } ; ,`) is removed entirely; whitespace around operators (and `=`, to stay WGSL-generic-safe) is preserved, so adjacent tokens never merge.
4. Rewrites the literal in place with [magic-string](https://github.com/Rich-Harris/magic-string), so sourcemaps stay intact.
5. Runs as a `pre` transform, so your bundler's own minifier still sees the result.

## Issues & compatibility

If you run into any problems — wrong output, a shader pattern that isn't picked up, or a library that doesn't play nicely — please [open an issue](https://github.com/jayf0x/compress-shader-literals/issues) or just mention which library you're using and I'll add it to the test suite.

## License

[MIT](./LICENSE) © [jayF0x](https://github.com/jayf0x)
