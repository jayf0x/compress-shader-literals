# compress-shader-literals

> **Size matters.** Strip everything strippable from your GLSL & WGSL shaders at build time.

> ⭐ Star this repository to support development and help others discover it.

[![npm version](https://img.shields.io/npm/v/compress-shader-literals?color=cb3837&logo=npm)](https://www.npmjs.com/package/compress-shader-literals)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/compress-shader-literals?color=success)](https://bundlephobia.com/package/compress-shader-literals)
[![npm downloads](https://img.shields.io/npm/dm/compress-shader-literals?color=success)](https://www.npmjs.com/package/compress-shader-literals)
[![license](https://img.shields.io/npm/l/compress-shader-literals?color=blue)](./LICENSE)

Your shaders ship to users as strings. This strips the comments and whitespace out of them at build time, before your bundler ever sees them — in any bundler.

The only minifier that reaches shaders already written as template literals in JS/TS — across any bundler — without renaming, without a toolchain, without runtime cost.

![Alt Preview](./assets/preview.png)

## Stats

The table below is an **engine benchmark**: it runs the built-in minifier over every shader these libraries ship and reports the bytes removed. Note two things, so the numbers aren't misread:

- These libraries **don't tag their shaders**, so the benchmark finds them by content. The plugin matches by tag (`` glsl`…` `` / `/* glsl */`), so out of the box it minifies **your own tagged shaders**, not a dependency's. Scanning dependencies is opt-in (clear `exclude`, and match by content with a custom `transform`).
- Every GLSL shader in this set is **parsed before and after** with [`@shaderfrog/glsl-parser`](https://github.com/shaderfrog/glsl-parser); the run fails if minify breaks one. The caption records the verified count.

<!-- STATS:START -->

| Package               | Shaders |    Before |     After |     Saved |
| --------------------- | ------: | --------: | --------: | --------: |
| `three`               |     281 | 240,772 B | 203,428 B | **15.5%** |
| `@jayf0x/fluidity-js` |       9 |  11,095 B |   7,788 B | **29.8%** |
| `ogl`                 |      22 |   6,109 B |   5,335 B | **12.7%** |
| `shader-park-core`    |      18 |  10,794 B |   9,033 B | **16.3%** |
| `curtainsjs`          |       7 |   3,406 B |   2,563 B | **24.8%** |
| **Total**             |     337 | 272,176 B | 228,147 B | **16.2%** |

_Engine benchmark — [`tests/e2e.js`](tests/e2e.js) runs the built-in `minifyShader` over every shader literal these libraries ship (detected by content, since they don't tag their shaders). 312 of 312 parseable GLSL shaders verified still valid after minify (0 broken). Packages [verified](tests/validate.js) loadable · 2026-06-29_

<!-- STATS:END -->

<!-- <a href="https://star-history.com/#jayf0x/compress-shader-literals&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=jayf0x/compress-shader-literals&type=Date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=jayf0x/compress-shader-literals&type=Date&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=jayf0x/compress-shader-literals&type=Date&legend=top-left" />
  </picture>
</a> -->

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

It finds tagged and comment-prefixed literals — and yes, the comment form keeps your editor's syntax highlighting:

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

Both collapse to a single tight line. No comments, no padding, no touched source files.

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

## How it works

Nothing clever, which is the point:

1. Parses each matched file with Babel (TS/JSX aware) — so it covers the JS/TS family (`.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts`, `.cts`), not `.vue`/`.svelte`/`.glsl` files, which aren't whole-file JS.
2. Finds tagged and comment-prefixed shader literals.
3. Strips comments + collapses whitespace via [`magic-string`](https://github.com/Rich-Harris/magic-string), so **sourcemaps stay intact**. Whitespace only ever collapses to a single space/newline, never to nothing, so tokens never merge and `#version`/`#define` lines survive — the output stays valid GLSL/WGSL ([proven](tests/e2e.js) against 300+ real-world shaders).
4. Runs as a `pre` transform, so your bundler's own minifier still sees the result.

It does **not** rename identifiers, eliminate dead code, or fold constants — that's a different (heavier, obfuscating) job. This only removes comments and whitespace, which is why the output stays readable and verifiably valid.

One [unplugin](https://github.com/unjs/unplugin) covers **Vite, Rollup, webpack, esbuild, Rspack, Rolldown & Farm**.

## Issues & compatibility

If you run into any problems — wrong output, a shader pattern that isn't picked up, or a library that doesn't play nicely — please [open an issue](https://github.com/jayf0x/compress-shader-literals/issues) or just mention which library you're using and I'll add it to the test suite.

## License

[MIT](./LICENSE) © [jayF0x](https://github.com/jayf0x)
