# compress-shader-literals

> **Size matters.** Strip everything strippable from your GLSL & WGSL shaders at build time.

> ⭐ Star this repository to support development and help others discover it.

[![npm version](https://img.shields.io/npm/v/compress-shader-literals?color=cb3837&logo=npm)](https://www.npmjs.com/package/compress-shader-literals)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/compress-shader-literals?color=success)](https://bundlephobia.com/package/compress-shader-literals)
[![npm downloads](https://img.shields.io/npm/dm/compress-shader-literals?color=success)](https://www.npmjs.com/package/compress-shader-literals)
[![license](https://img.shields.io/npm/l/compress-shader-literals?color=blue)](./LICENSE)

A tiny build-time minifier for GLSL & WGSL shaders written as template literals in your JS/TS. Strips comments + whitespace — any bundler, no renaming, no toolchain, no runtime cost.

![Alt Preview](./assets/preview.png)

## Install

<!-- [![NPM](https://nodei.co/npm/compress-shader-literals.png)](https://www.npmjs.com/package/compress-shader-literals) -->

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

| Option        | Default                      | Description                                                                |
| ------------- | ---------------------------- | -------------------------------------------------------------------------- |
| `tags`        | `['glsl', 'wgsl', 'shader']` | Tag names / comment markers to match                                       |
| `scan`        | `'ast'`                      | `'ast'` parses the file with Babel; `'loose'` matches by regex — see below |
| `include`     | `[/\.[mc]?[jt]sx?$/]`        | Files to process — the JS/TS family Babel can parse                        |
| `exclude`     | `[/node_modules/, /dist/]`   | Files to skip — dependencies are skipped by default                        |
| `outputRatio` | `false`                      | Print a bytes-saved summary after build                                    |
| `transform`   | built-in `minifyShader`      | Custom minifier — `(shader: string) => string`                             |
| `debug`       | `false`                      | Log each file's discovered literals to the console                         |
| `validate`    | `false`                      | Re-parse each changed shader and warn on build if one stops parsing        |

**`validate: true`** — re-parses every shader the plugin touches, before and after, and warns (via the bundler's normal warning channel) if one stopped parsing. Needs [`@shaderfrog/glsl-parser`](https://www.npmjs.com/package/@shaderfrog/glsl-parser) (GLSL) and/or [`wgsl_reflect`](https://www.npmjs.com/package/wgsl_reflect) (WGSL) installed — both are optional peer dependencies, loaded lazily so builds that don't opt in never pay for them:

```js
compressShaderLiterals.vite({ validate: true });
```

**`scan: 'loose'`** — for files Babel can't parse (anything that isn't plain JS/TS: Svelte components, Astro components, etc). Instead of a whole-file AST parse, it matches the same tagged/comment-prefixed literal shapes by regex. Opt in and point `include` at the files yourself — there's no whole-file syntax guarantee, so a match is only touched once its content also looks like a real shader:

```js
compressShaderLiterals.vite({ scan: 'loose', include: [/\.svelte$/] });
```

**Programmatic API** — the core helpers are exported for tooling authors (validators, ESLint rules, CLIs), no plugin required:

```js
import { extractShaderLiterals, extractShaderLiteralsLoose, minifyShader } from 'compress-shader-literals';

extractShaderLiterals('const v = glsl`void main() {}`');
// → [{ tag: 'glsl', value: 'void main() {}', start: 14, end: 30 }]

extractShaderLiteralsLoose('<script>const v = glsl`void main() {}`</script>');
// → same shape, found by regex instead of a Babel parse

minifyShader('// comment\nvoid  main() {}'); // → 'void main() {}'
```

## Stats

Real shaders shipped by popular libraries, run through the built-in minifier:

<!-- STATS:START -->

| Package                       | Shaders |      Before |       After |     Saved | Net after Brotli |
| ----------------------------- | ------: | ----------: | ----------: | --------: | ---------------: |
| `vtk.js`                      |     142 |   276,617 B |   157,780 B | **43.0%** |           +39.5% |
| `three-stdlib`                |     370 |   429,350 B |   266,774 B | **37.9%** |           +35.5% |
| `curtainsjs`                  |       7 |     3,406 B |     2,290 B | **32.8%** |           +10.4% |
| `hydra-synth`                 |      15 |     3,852 B |     2,591 B | **32.7%** |           +17.9% |
| `cesium`                      |     546 |   951,897 B |   649,851 B | **31.7%** |           +32.6% |
| `troika-three-utils`          |       4 |       168 B |       120 B | **28.6%** |           +32.3% |
| `shader-park-core`            |      18 |    10,794 B |     7,863 B | **27.2%** |           +19.7% |
| `pixi.js`                     |     162 |    75,768 B |    55,260 B | **27.1%** |           +16.3% |
| `@luma.gl/shadertools`        |      24 |   149,192 B |   109,615 B | **26.5%** |           +29.9% |
| `three`                       |     281 |   240,906 B |   181,942 B | **24.5%** |           +25.5% |
| `ogl`                         |      22 |     6,109 B |     4,821 B | **21.1%** |            +9.1% |
| `playcanvas`                  |     856 | 1,297,844 B | 1,025,421 B | **21.0%** |           +49.1% |
| `deck.gl`                     |     132 |   242,113 B |   195,406 B | **19.3%** |           +31.1% |
| `@paper-design/shaders`       |      30 |   142,466 B |   118,204 B | **17.0%** |            +8.9% |
| `@deck.gl/layers`             |     104 |   223,902 B |   192,483 B | **14.0%** |           +32.4% |
| `@deck.gl/core`               |      40 |    17,746 B |    15,494 B | **12.7%** |            +9.1% |
| `@deck.gl/aggregation-layers` |      56 |    43,713 B |    38,382 B | **12.2%** |           +25.3% |
| `@luma.gl/engine`             |      29 |    11,357 B |    10,206 B | **10.1%** |            +3.1% |
| `@babylonjs/core`             |     349 |   669,740 B |   660,843 B |  **1.3%** |            +2.1% |
| `postprocessing`              |     136 |   179,705 B |   179,705 B |  **0.0%** |            +0.0% |
| **Total**                     |    3323 | 4,976,645 B | 3,875,051 B | **22.1%** |                — |

_2477/3323 parseable shaders. ✅ Verified 2026-07-13. [How this is measured](docs/stats.md)_

<!-- STATS:END -->

## How it works

1. Parses each matched file with Babel — `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts`, `.cts` by default. `scan: 'loose'` skips the parse and matches by regex instead, for files Babel can't parse.
2. Finds tagged (`` glsl`…` ``) and comment-prefixed (`/* glsl */ \`…\``) literals, skipping any with `${…}` interpolation.
3. Strips comments, collapses whitespace, and joins statements onto one line — keeping real newlines around `#` preprocessor directives and `\` line-continuations (which are newline-sensitive). Whitespace hugging a delimiter (`( ) { } ; ,`) is removed entirely; whitespace around operators (and `=`, to stay WGSL-generic-safe) is preserved, so adjacent tokens never merge.
4. Rewrites the literal in place with [magic-string](https://github.com/Rich-Harris/magic-string), so sourcemaps stay intact.
5. Runs as a `pre` transform, so your bundler's own minifier still sees the result.

## Issues & compatibility

If you run into any problems — wrong output, a shader pattern that isn't picked up, or a library that doesn't play nicely — please [open an issue](https://github.com/jayf0x/compress-shader-literals/issues) or just mention which library you're using and I'll add it to the test suite.

## License

[MIT](./LICENSE) © [jayF0x](https://github.com/jayf0x)
