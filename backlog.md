# Backlog

Each item points at the files to read first. Research before building.

## "Loose" scan mode — reach any file type

files: `src/plugin.js` (filter + transform), `src/defaults.js` (`DEFAULT_INCLUDE`), `src/core.js` (`extractShaderLiterals`)

task: add an opt-in `scan: 'loose'` option that finds tagged and comment-prefixed shader literals by regex across any file, bypassing the whole-file Babel parse. Babel is JS/TS-only, so today `.vue` / `.svelte` / `.astro` / `.glsl` files yield nothing even if included. Keep the current Babel path (`scan: 'ast'`) as the default.

goal: minify shaders living in SFCs and non-JS containers without corrupting non-shader files. Gate every loose match by a content signal before stripping (reuse `SHADER_SIGNAL` in `tests/utils.js`) — the regex finds candidates, the signal confirms they're shaders.

test target: `lygia` is a good showcase — it ships raw `.glsl`/`.wgsl`/`.wesl` files (and stores shaders as plain string properties in a `weslBundle`, not template literals), so the current AST scanner extracts 0 from it. A loose/file scanner would reach it. Note two blockers: its shaders are mostly `#include`-style fragments (won't pass `SHADER_SIGNAL`, which wants a full-shader marker like `void main`), and it exposes no bare import, so `validate.js` can't load it — a loose-scan benchmark would need a file-based corpus path, not the `dependencies` + import route.

## Extend shader validation — cover the WGSL/fragment blind spot

files: `tests/e2e.js` + `tests/experimental.js` (GLSL gate via `@shaderfrog/glsl-parser`), `tests/utils.js` (`validateGlsl`), `src/plugin.js`

why: the parser gate covers GLSL only; roughly a third of the corpus (WGSL + glslify fragments) can't be parse-checked. `validateGlsl` already applies two parser-free invariants there (`continuationOk`, `bracketsOk`) that catch gross corruption in any dialect — but those prove absence of bracket/continuation damage, not full validity. Two ways left to close the gap:

- **(a) Wire a real WGSL parser** (`naga` via `naga-wasm`, or similar) into `validateGlsl` so WGSL gets the same before/after parse guarantee as GLSL. Biggest remaining coverage win — WGSL is ~a fifth of the corpus and only structurally checked today.
- **(c) Opt-in `validate: true` in the plugin.** Re-parse each shader the plugin touches at build time and warn when one stops parsing, so user shaders outside the benchmark corpus get the same guarantee. Reuse `validateGlsl`.

## Dialect-aware `=` trimming — reclaim the WGSL-blocked bytes

files: `src/core.js` (`minifyShader`), `src/defaults.js` (`RE_DELIM_WS`), `tests/utils.js` (`isWGSL`), `tests/experimental.js`

why: the delimiter pass strips whitespace around `( ) { } ; ,` but deliberately excludes `=`, because in WGSL `vec2<f32> = a` would weld the generic-close `>` onto `=` into a `>=` token. That exclusion is only needed for WGSL — GLSL has no `<>` generics, so stripping around `=` is safe there. Measured this session: adding `=` back took raw savings from ~9.5% to ~10.5% on the (then) corpus — a real ~1% left on the table for GLSL shaders.

task: when a shader is confidently GLSL (not `isWGSL`), also trim around `=` (and `==`/`<=`/`>=`/`!=`/`+=`… must stay intact — only strip a lone `=` with spaces on both sides, never a digraph). Prototype in `tests/experimental.js`, prove 0 broken on the GLSL gate, and confirm WGSL output is untouched. Keep the WGSL-safe path exactly as-is.

goal: recover the GLSL `=` bytes without reintroducing the WGSL `>=` welding.

## Replace hand-rolled regexes with a parser/library

files: `src/core.js` (`minifyShader` — comment + whitespace regexes), `src/defaults.js` (`tagCommentRe`), `tests/experimental.js` (candidate + gate)

task: needs research first. `minifyShader` strips comments with regexes (`/\/\*...\*\//`, `/\/\/.*$/`) and does whitespace/newline handling as a hand-rolled line pass — brittle and hard to reason about. Evaluate replacing them:

- **Comment stripping:** `extract-comments` / `strip-comments` are options, but they're tuned for JS (string- and regex-literal-aware) — GLSL has no string literals, so the extra machinery buys little and adds a dependency. Confirm whether they even improve correctness over the current regex before adopting.
- **The real debt is the whitespace/newline pass** (statement joining, `#`-directive and `\`-continuation handling), which no comment library touches. Going properly regex-free there means tokenizing GLSL — `@shaderfrog/glsl-parser` is already a `tests/`-only dep and could lex → re-emit. That's the heavier, more correct path; weigh it against "stay tiny and boring" (AGENTS.md) and the fact that a tokenizer is WGSL-blind.
- **Prior art:** `glsl-tokenizer` + `glsl-token-whitespace-trim` (~800k downloads) is the proven token-based reference — it's where the delimiter-trim trick came from. It's GLSL-only (hence WGSL-blind, and it trims around `=` unsafely for our WGSL needs). Study it before rebuilding a tokenizer path; it shows both the technique and its dialect ceiling.

goal: decide, with a prototype in `tests/experimental.js` measured against the current output, whether dropping the hand-rolled passes is a net win (fewer edge-case bugs) or just a heavier dependency for the same result. Don't add a parser to `src` runtime deps unless it demonstrably prevents a real corruption the current code misses.

## Comparison / relevance stats vs other minifiers

files: `tests/e2e.js`, `docs/stats.md`, README stats block, plus this session's research notes (see `laurentlb/shader-minifier`, https://www.ctrl-alt-test.fr/glsl-minifier/)

task: needs research first. Build clean stats comparing this tool to other minifiers usable in a Vite pipeline — Terser, UglifyJS, JSMin — and measure the _marginal_ bytes we save on top of an already-JS-minified bundle. Open question to answer: do those JS minifiers touch template-literal contents at all? (They generally don't — that's the hypothesis to confirm/refute.) Decide whether this lives as a comparison table in README or a local-only e2e benchmark.

goal: honest answer to "is this still relevant once Terser has run / when shaders are already optimized?" `laurentlb/shader-minifier` is the heavyweight reference (renaming + dead-code elimination); this tool is effectively the whitespace/comment subset of that, as a bundler plugin. Quantify the real-world relevance instead of asserting it.

## Parallelize `e2e.js` package scanning

files: `tests/e2e.js` (`benchPackage`), `tests/utils.js` (`jsFiles`, `shadersInCode`)

why: the ~90s+ runtime of `bun run test:e2e` is NOT `validate.js` (measured standalone: ~1.5s for all 20 packages' `import()`). It's `benchPackage`'s `jsFiles` + `shadersInCode` — walking every file a package ships and running a full Babel `parse`/`traverse` over each one to find shader literals. Measured per-package: `cesium` ~16s, `playcanvas` ~10s, `three` ~4.8s, `pixi.js` ~4.5s, `@babylonjs/core` ~4.3s — big installed trees, not big shader counts. Pre-existing cost, not caused by any recent change to the stats table.

task: each package's scan is independent — no shared state, output is just `{ pkg, count, before, after }`. Fan `benchPackage` calls out across worker processes/threads (`node:child_process` or `node:worker_threads`), collect results, then do the existing sort/brotli-sample/table/write in the parent. Keep today's synchronous single-process path as a fallback if parallelizing isn't worth the complexity for a `tests/`-only script.

goal: get real wall-clock time down without touching what's measured or reported.

## Expand the test corpus beyond npm

files: `tests/utils.js` (`collectShaders`, `packages`), `tests/e2e.js`

why: the corpus is npm packages that ship shaders as JS template literals — but that's only ~40–60% of real-world shader code. The rest lives where today's scanner can't reach:

- GitHub shader repos
- engine `/shaders/` folders
- examples directories
- CDN snippets (Hydra, ShaderToy, etc.)

goal: broaden the corpus so the stats and validity gate reflect real usage, not just npm. Pairs with "Loose scan mode" above — both need a file-based corpus path, not the `dependencies` + import route.
