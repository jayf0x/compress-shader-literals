# Backlog

Each item points at the files to read first. Research before building.

## Extend shader validation — opt-in build-time validation

files: `src/plugin.js`, `tests/utils.js` (`validateGlsl`)

why: `validateGlsl` now parses both dialects for real — `@shaderfrog/glsl-parser` for GLSL, `wgsl_reflect` (a `tests/`-only dep) for WGSL — so the benchmark corpus gets a genuine before/after parse guarantee either way. Unparseable fragments (glslify chunks missing `#include` context, macro-laden WGSL like Babylon.js's `#ifdef`-guarded shaders) are still out of scope for any parser, but are still structurally checked (`bracketsOk`, `continuationOk`). What's left: this guarantee only covers the benchmark corpus, not a user's own shaders.

- **Opt-in `validate: true` in the plugin.** Re-parse each shader the plugin touches at build time and warn when one stops parsing, so user shaders outside the benchmark corpus get the same guarantee. Reuse `validateGlsl` (move it, or the parsing it wraps, from `tests/utils.js` into `src/` if this ships — decide whether `wgsl_reflect`/`@shaderfrog/glsl-parser` are worth adding as real runtime deps for an opt-in feature, given "stay tiny and boring").

## ~~Dialect-aware `=` trimming — reclaim the WGSL-blocked bytes~~ (done)

Shipped in `src/core.js` (`minifyShader`) / `src/defaults.js` (`RE_EQ_WS`, `isWGSL` moved here from `tests/utils.js`, which now re-exports it). `minifyShader` trims whitespace around a lone `=` whenever `!isWGSL(src)`, and `RE_EQ_WS` itself carries a `(?<!>)` lookbehind as a second, non-heuristic guard against the `>=` welding case — belt-and-suspenders since `isWGSL` is keyword-sniffing and can miss a WGSL fragment with no marker in view. Digraphs (`==`/`<=`/`>=`/`!=`/`+=`…) are naturally untouched: none of them have whitespace between their own characters in valid source, so the "whitespace on both immediate sides" match never fires inside one. Corpus gate (`tests/experimental.js`) run against all 3323 shaders: 0 broken, raw savings up from prior baseline. Regression tests added in `tests/core.test.js`.

## Comparison / relevance stats vs other minifiers

files: `tests/e2e.js`, `docs/stats.md`, README stats block, plus this session's research notes (see `laurentlb/shader-minifier`, https://www.ctrl-alt-test.fr/glsl-minifier/)

task: needs research first. Build clean stats comparing this tool to other minifiers usable in a Vite pipeline — Terser, UglifyJS, JSMin — and measure the _marginal_ bytes we save on top of an already-JS-minified bundle. Open question to answer: do those JS minifiers touch template-literal contents at all? (They generally don't — that's the hypothesis to confirm/refute.) Decide whether this lives as a comparison table in README or a local-only e2e benchmark.

goal: honest answer to "is this still relevant once Terser has run / when shaders are already optimized?" `laurentlb/shader-minifier` is the heavyweight reference (renaming + dead-code elimination); this tool is effectively the whitespace/comment subset of that, as a bundler plugin. Quantify the real-world relevance instead of asserting it.

## Expand the test corpus beyond npm

files: `tests/utils.js` (`collectShaders`, `packages`), `tests/e2e.js`

why: the corpus is npm packages that ship shaders as JS template literals — but that's only ~40–60% of real-world shader code. The rest lives where today's scanner can't reach:

- GitHub shader repos
- engine `/shaders/` folders
- examples directories
- CDN snippets (Hydra, ShaderToy, etc.)

goal: broaden the corpus so the stats and validity gate reflect real usage, not just npm. Needs a file-based corpus path, not the `dependencies` + import route — same gap `scan: 'loose'` benchmarking would hit (raw `.glsl`/`.wesl` files, e.g. `lygia`, aren't reachable via npm `import()` and are mostly `#include`-style fragments that won't pass `SHADER_SIGNAL` anyway).
