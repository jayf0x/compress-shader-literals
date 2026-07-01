# Backlog

Each item points at the files to read first. Research before building.

## "Loose" scan mode — reach any file type

files: `src/plugin.js` (filter + transform), `src/defaults.js` (`DEFAULT_INCLUDE`), `src/core.js` (`extractShaderLiterals`)

task: add an opt-in `scan: 'loose'` option that finds tagged and comment-prefixed shader literals by regex across any file, bypassing the whole-file Babel parse. Babel is JS/TS-only, so today `.vue` / `.svelte` / `.astro` / `.glsl` files yield nothing even if included. Keep the current Babel path (`scan: 'ast'`) as the default.

goal: minify shaders living in SFCs and non-JS containers without corrupting non-shader files. Gate every loose match by a content signal before stripping (reuse `SHADER_SIGNAL` in `tests/utils.js`) — the regex finds candidates, the signal confirms they're shaders.

test target: `lygia` is a good showcase — it ships raw `.glsl`/`.wgsl`/`.wesl` files (and stores shaders as plain string properties in a `weslBundle`, not template literals), so the current AST scanner extracts 0 from it. A loose/file scanner would reach it. Note two blockers: its shaders are mostly `#include`-style fragments (won't pass `SHADER_SIGNAL`, which wants a full-shader marker like `void main`), and it exposes no bare import, so `validate.js` can't load it — a loose-scan benchmark would need a file-based corpus path, not the `dependencies` + import route.

## Extend shader validation — cover the WGSL/fragment blind spot

files: `tests/e2e.js` + `tests/experimental.js` (GLSL gate via `@shaderfrog/glsl-parser`), `tests/utils.js` (`validateGlsl`), `src/plugin.js`

why: the gate parse-checks GLSL only. Roughly a third of the corpus (WGSL + glslify fragments) is skipped, not verified — and `minifyShader` runs on it. Three ways to shrink that gap:

- **(a) Wire a real WGSL parser** (`naga` via `naga-wasm`, or similar) into `validateGlsl` so WGSL gets the same before/after parse guarantee as GLSL. Biggest single coverage win — WGSL is ~a fifth of the corpus.
- **(b) Structural invariants for glslify fragments.** They don't parse standalone even _before_ minify (missing `#include` context), so no parser can gate them. Add parser-free before==after invariants (balanced braces/parens, `;` count preserved) on top of the existing `continuationOk` check.
- **(c) Opt-in `validate: true` in the plugin.** Re-parse each shader the plugin touches at build time and warn when one stops parsing, so user shaders outside the benchmark corpus get the same guarantee. Reuse `validateGlsl`.

## Replace hand-rolled regexes with a parser/library

files: `src/core.js` (`minifyShader` — comment + whitespace regexes), `src/defaults.js` (`tagCommentRe`), `tests/experimental.js` (candidate + gate)

task: needs research first. `minifyShader` strips comments with regexes (`/\/\*...\*\//`, `/\/\/.*$/`) and does whitespace/newline handling as a hand-rolled line pass — brittle and hard to reason about. Evaluate replacing them:

- **Comment stripping:** `extract-comments` / `strip-comments` are options, but they're tuned for JS (string- and regex-literal-aware) — GLSL has no string literals, so the extra machinery buys little and adds a dependency. Confirm whether they even improve correctness over the current regex before adopting.
- **The real debt is the whitespace/newline pass** (statement joining, `#`-directive and `\`-continuation handling), which no comment library touches. Going properly regex-free there means tokenizing GLSL — `@shaderfrog/glsl-parser` is already a `tests/`-only dep and could lex → re-emit. That's the heavier, more correct path; weigh it against "stay tiny and boring" (AGENTS.md) and the fact that a tokenizer is WGSL-blind.

goal: decide, with a prototype in `tests/experimental.js` measured against the current output, whether dropping the hand-rolled passes is a net win (fewer edge-case bugs) or just a heavier dependency for the same result. Don't add a parser to `src` runtime deps unless it demonstrably prevents a real corruption the current code misses.

## Comparison / relevance stats vs other minifiers

files: `tests/e2e.js`, `docs/stats.md`, README stats block, plus this session's research notes (see `laurentlb/shader-minifier`, https://www.ctrl-alt-test.fr/glsl-minifier/)

task: needs research first. Build clean stats comparing this tool to other minifiers usable in a Vite pipeline — Terser, UglifyJS, JSMin — and measure the _marginal_ bytes we save on top of an already-JS-minified bundle. Open question to answer: do those JS minifiers touch template-literal contents at all? (They generally don't — that's the hypothesis to confirm/refute.) Decide whether this lives as a comparison table in README or a local-only e2e benchmark.

goal: honest answer to "is this still relevant once Terser has run / when shaders are already optimized?" `laurentlb/shader-minifier` is the heavyweight reference (renaming + dead-code elimination); this tool is effectively the whitespace/comment subset of that, as a bundler plugin. Quantify the real-world relevance instead of asserting it.
