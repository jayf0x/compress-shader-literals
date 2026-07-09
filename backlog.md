# Backlog

Each item points at the files to read first. Research before building.

## "Loose" scan mode — reach any file type

files: `src/plugin.js` (filter + transform), `src/defaults.js` (`DEFAULT_INCLUDE`), `src/core.js` (`extractShaderLiterals`)

task: add an opt-in `scan: 'loose'` option that finds tagged and comment-prefixed shader literals by regex across any file, bypassing the whole-file Babel parse. Babel is JS/TS-only, so today `.vue` / `.svelte` / `.astro` / `.glsl` files yield nothing even if included. Keep the current Babel path (`scan: 'ast'`) as the default.

goal: minify shaders living in SFCs and non-JS containers without corrupting non-shader files. Gate every loose match by a content signal before stripping (reuse `SHADER_SIGNAL` in `tests/utils.js`) — the regex finds candidates, the signal confirms they're shaders.

test target: `lygia` is a good showcase — it ships raw `.glsl`/`.wgsl`/`.wesl` files (and stores shaders as plain string properties in a `weslBundle`, not template literals), so the current AST scanner extracts 0 from it. A loose/file scanner would reach it. Note two blockers: its shaders are mostly `#include`-style fragments (won't pass `SHADER_SIGNAL`, which wants a full-shader marker like `void main`), and it exposes no bare import, so `validate.js` can't load it — a loose-scan benchmark would need a file-based corpus path, not the `dependencies` + import route.

## Extend shader validation — opt-in build-time validation

files: `src/plugin.js`, `tests/utils.js` (`validateGlsl`)

why: `validateGlsl` now parses both dialects for real — `@shaderfrog/glsl-parser` for GLSL, `wgsl_reflect` (a `tests/`-only dep) for WGSL — so the benchmark corpus gets a genuine before/after parse guarantee either way. Unparseable fragments (glslify chunks missing `#include` context, macro-laden WGSL like Babylon.js's `#ifdef`-guarded shaders) are still out of scope for any parser, but are still structurally checked (`bracketsOk`, `continuationOk`). What's left: this guarantee only covers the benchmark corpus, not a user's own shaders.

- **Opt-in `validate: true` in the plugin.** Re-parse each shader the plugin touches at build time and warn when one stops parsing, so user shaders outside the benchmark corpus get the same guarantee. Reuse `validateGlsl` (move it, or the parsing it wraps, from `tests/utils.js` into `src/` if this ships — decide whether `wgsl_reflect`/`@shaderfrog/glsl-parser` are worth adding as real runtime deps for an opt-in feature, given "stay tiny and boring").

## Dialect-aware `=` trimming — reclaim the WGSL-blocked bytes

files: `src/core.js` (`minifyShader`), `src/defaults.js` (`RE_DELIM_WS`), `tests/utils.js` (`isWGSL`), `tests/experimental.js`

why: the delimiter pass strips whitespace around `( ) { } ; ,` but deliberately excludes `=`, because in WGSL `vec2<f32> = a` would weld the generic-close `>` onto `=` into a `>=` token. That exclusion is only needed for WGSL — GLSL has no `<>` generics, so stripping around `=` is safe there. Measured this session: adding `=` back took raw savings from ~9.5% to ~10.5% on the (then) corpus — a real ~1% left on the table for GLSL shaders.

task: when a shader is confidently GLSL (not `isWGSL`), also trim around `=` (and `==`/`<=`/`>=`/`!=`/`+=`… must stay intact — only strip a lone `=` with spaces on both sides, never a digraph). Prototype in `tests/experimental.js`, prove 0 broken on the GLSL gate, and confirm WGSL output is untouched. Keep the WGSL-safe path exactly as-is.

goal: recover the GLSL `=` bytes without reintroducing the WGSL `>=` welding.

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

goal: broaden the corpus so the stats and validity gate reflect real usage, not just npm. Pairs with "Loose scan mode" above — both need a file-based corpus path, not the `dependencies` + import route.
