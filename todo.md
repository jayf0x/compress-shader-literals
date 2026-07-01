# TODO — next-agent handoff

Short intent note for whoever picks this up next. Full detail lives in [`backlog.md`](backlog.md); this is just what matters most and why.

## State (as of this writing)

The minifier is reliable across GLSL and WGSL: whitespace/comment stripping, statement joining, `#`/`\`-continuation preservation, and safe delimiter (`( ) { } ; ,`) trimming. Benchmarked on a 3.3k-shader corpus (21 real libraries) at ~21% raw / ~26% gzip, **0 broken** on 2.3k parse-verified GLSL shaders. The WGSL + glslify-fragment third that no parser covers is guarded by parser-free structural invariants (`bracketsOk`, `continuationOk`).

## Most critical thing left

**Wire a real WGSL parser** — [`backlog.md` → "Extend shader validation" (a)]. WGSL is ~a fifth of the corpus and today only gets the structural smoke check, not a real before/after parse. It's the largest remaining correctness blind spot; a user-reported break would most likely come from here. `naga` via `naga-wasm` is the candidate. Do this before promising WGSL the same guarantee GLSL has.

## Easy, already-scoped win

**Dialect-aware `=` trimming** — [`backlog.md` → "Dialect-aware `=` trimming"]. Measured ~1% extra raw savings, currently withheld only to protect WGSL generics (`vec2<f32> = a` → `>=`). Safe to reclaim for confidently-GLSL shaders. Small, high-confidence, already prototyped-in-principle this session.

## Everything else

Tracked in `backlog.md`: loose/file scan mode (reach `.vue`/`.glsl`/lygia), plugin `validate: true` opt-in, replacing the hand-rolled regex passes with a tokenizer (prior art: `glsl-token-whitespace-trim`), and a marginal-savings comparison vs Terser/UglifyJS.

## Workflow reminder

Prove any new compression idea in `tests/experimental.js` (`bun run tests:next`) against the real corpus with **0 broken** before graduating it into `src/core.js`. That's how the delimiter trim shipped.
