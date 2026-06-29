# Backlog

Each item points at the files to read first. Research before building.

## "Loose" scan mode — reach any file type

files: `src/plugin.js` (filter + transform), `src/defaults.js` (`DEFAULT_INCLUDE`), `src/core.js` (`extractShaderLiterals`)

task: add an opt-in `scan: 'loose'` option that finds tagged and comment-prefixed shader literals by regex across any file, bypassing the whole-file Babel parse. Babel is JS/TS-only, so today `.vue` / `.svelte` / `.astro` / `.glsl` files yield nothing even if included. Keep the current Babel path (`scan: 'ast'`) as the default.

goal: minify shaders living in SFCs and non-JS containers without corrupting non-shader files. Gate every loose match by a content signal before stripping (reuse `SHADER_SIGNAL` in `tests/e2e.js`) — the regex finds candidates, the signal confirms they're shaders.

## Extend shader validation

files: `tests/e2e.js` (existing GLSL gate via `@shaderfrog/glsl-parser`), `src/plugin.js`

task: `tests/e2e.js` already fails the run if minify breaks a GLSL shader that parsed before. Two gaps left: (a) WGSL has no parser wired — pick one (naga-wasm or a WGSL parser) or keep skipping it honestly; (b) optional opt-in `validate: true` in the plugin that re-parses each shader it touches and warns when one stops parsing, so user shaders get the same guarantee as the benchmark set.

goal: validity guaranteed beyond the benchmark corpus, and WGSL covered.

## Comparison / relevance stats vs other minifiers

files: `tests/e2e.js`, `docs/stats.md`, README stats block, plus this session's research notes (see `laurentlb/shader-minifier`, https://www.ctrl-alt-test.fr/glsl-minifier/)

task: needs research first. Build clean stats comparing this tool to other minifiers usable in a Vite pipeline — Terser, UglifyJS, JSMin — and measure the _marginal_ bytes we save on top of an already-JS-minified bundle. Open question to answer: do those JS minifiers touch template-literal contents at all? (They generally don't — that's the hypothesis to confirm/refute.) Decide whether this lives as a comparison table in README or a local-only e2e benchmark.

goal: honest answer to "is this still relevant once Terser has run / when shaders are already optimized?" `laurentlb/shader-minifier` is the heavyweight reference (renaming + dead-code elimination); this tool is effectively the whitespace/comment subset of that, as a bundler plugin. Quantify the real-world relevance instead of asserting it.
