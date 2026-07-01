# Backlog

Each item points at the files to read first. Research before building.

## "Loose" scan mode — reach any file type

files: `src/plugin.js` (filter + transform), `src/defaults.js` (`DEFAULT_INCLUDE`), `src/core.js` (`extractShaderLiterals`)

task: add an opt-in `scan: 'loose'` option that finds tagged and comment-prefixed shader literals by regex across any file, bypassing the whole-file Babel parse. Babel is JS/TS-only, so today `.vue` / `.svelte` / `.astro` / `.glsl` files yield nothing even if included. Keep the current Babel path (`scan: 'ast'`) as the default.

goal: minify shaders living in SFCs and non-JS containers without corrupting non-shader files. Gate every loose match by a content signal before stripping (reuse `SHADER_SIGNAL` in `tests/utils.js`) — the regex finds candidates, the signal confirms they're shaders.

## Extend shader validation — cover the WGSL/fragment blind spot

files: `tests/e2e.js` + `tests/experimental.js` (GLSL gate via `@shaderfrog/glsl-parser`), `tests/utils.js` (`validateGlsl`, `continuationOk`), `src/plugin.js`

state: as of the current corpus (869 shaders, 7 libs), the gate verifies **558 GLSL shaders (0 broken)** but leaves **190 WGSL + 121 glslify fragments = 311 (36%) unverified**. `minifyShader` runs on all of them; the only thing guarding the unverified 311 is `continuationOk` (a dialect-agnostic `\`-continuation smoke check). This is now the sharpest edge, because the aggressive whitespace pass (statement-joining) ships as the default — a real user issue would most likely come from here.

task, three gaps:

- **(a) WGSL has a real parser now (190 shaders, ~22% of corpus).** Wire `naga` (via `naga-wasm`) or another WGSL parser into `validateGlsl` so WGSL gets the same before/after parse guarantee as GLSL, instead of being skipped. Biggest single coverage win.
- **(b) glslify fragments (121).** These don't parse standalone even _before_ minify (missing `#include` context), so a parser can't gate them. Best reachable guarantee is a structural invariant that doesn't need a full parse — `continuationOk` is the first; consider more (balanced braces/parens before==after, no `;` lost) rather than trying to make them parse.
- **(c) opt-in `validate: true` in the plugin.** Re-parse each shader the plugin touches at build time and warn when one stops parsing, so real user shaders (outside the benchmark corpus) get the same guarantee. Reuse `validateGlsl`.

goal: shrink the unverified 36% — WGSL parsed (a), fragments structurally guarded (b), and the guarantee extended to user shaders at build time (c).

## Replace hand-rolled regexes with a parser/library

files: `src/core.js` (`minifyShader` — comment + whitespace regexes), `src/defaults.js` (`tagCommentRe`), `tests/experimental/` (candidate + gate)

task: needs research first. The minifier is a stack of regexes (`/\/\*...\*\//`, `/\/\/.*$/`, whitespace collapse) — brittle and hard to reason about. Evaluate replacing them:

- **Comment stripping:** `extract-comments` / `strip-comments` are options, but they're tuned for JS (string- and regex-literal-aware) — GLSL has no string literals, so the extra machinery buys little and adds a dependency. Confirm whether they even improve correctness over the current regex before adopting.
- **The real regex debt is whitespace/newline handling**, which no comment library touches. Going properly regex-free there means tokenizing GLSL — `@shaderfrog/glsl-parser` is already a `tests/`-only dep and could lex → re-emit. That's the heavier, more correct path; weigh it against "stay tiny and boring" (AGENTS.md) and the fact that a tokenizer is WGSL-blind.

goal: decide, with a prototype in `tests/experimental` measured against the current regex output, whether dropping regexes is a net win (fewer edge-case bugs) or just a heavier dependency for the same result. Don't add a parser to `src` runtime deps unless it demonstrably prevents a real corruption the regexes miss.

## Comparison / relevance stats vs other minifiers

files: `tests/e2e.js`, `docs/stats.md`, README stats block, plus this session's research notes (see `laurentlb/shader-minifier`, https://www.ctrl-alt-test.fr/glsl-minifier/)

task: needs research first. Build clean stats comparing this tool to other minifiers usable in a Vite pipeline — Terser, UglifyJS, JSMin — and measure the _marginal_ bytes we save on top of an already-JS-minified bundle. Open question to answer: do those JS minifiers touch template-literal contents at all? (They generally don't — that's the hypothesis to confirm/refute.) Decide whether this lives as a comparison table in README or a local-only e2e benchmark.

goal: honest answer to "is this still relevant once Terser has run / when shaders are already optimized?" `laurentlb/shader-minifier` is the heavyweight reference (renaming + dead-code elimination); this tool is effectively the whitespace/comment subset of that, as a bundler plugin. Quantify the real-world relevance instead of asserting it.
