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

## Compress harder (whitespace) — without becoming a heavyweight minifier

files: `src/core.js` (`minifyShader`), `tests/experimental/` (prototype + measurement harness), `src/plugin.js` (byte-snap accumulation)

task: `minifyShader` today leaves easy bytes on the table — a leading space per line, blank lines that survive because they're `' \n'` not `'\n\n'`, and a newline between every statement that GLSL doesn't need. Tighten the whitespace pass to trim per line, drop blank lines, and join statements (keeping real newlines only around `#` preprocessor directives, which are newline-sensitive). Stay whitespace/comment-only — identifier renaming and operator-space removal belong to heavyweight minifiers (`laurentlb/shader-minifier`) and risk breaking shaders; we are the light-weight, compatible layer.

goal: measurably smaller output (raw, and a little post-gzip) with zero regressions on the GLSL validity gate. Prototype and prove it in `tests/experimental` (run `bun run tests:next`) before touching `src/core.js`; the win is mostly raw bytes, so it matters most for un-gzipped delivery and inline/parsed-at-runtime shader strings.

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
