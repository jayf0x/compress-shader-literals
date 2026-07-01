# AGENTS.md

## What this is

A universal bundler plugin (built on [unplugin](https://github.com/unjs/unplugin)) that minifies GLSL/WGSL shader **template literals** in source at build time — strips comments, collapses whitespace — before the host bundler runs. Published to npm as `compress-shader-literals`.

Intent: stay tiny and boring. This is a one-job tool. Resist scope creep.

## Layout

| Path                     | Role                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core.js`            | The engine: `extractShaderLiterals` (Babel AST) + `minifyShader`                                                                        |
| `src/defaults.js`        | Shared defaults + patterns (tags, include/exclude, comment regex)                                                                       |
| `src/plugin.js`          | unplugin wrapper; `outputRatio` stats via `byte-snap`                                                                                   |
| `src/index.js`           | Re-export entry                                                                                                                         |
| `src/index.d.ts`         | Hand-written types (no TS build — copied to `dist/` on build)                                                                           |
| `tests/core.test.js`     | Unit tests (`bun test`)                                                                                                                 |
| `tests/plugin.test.js`   | Plugin with/without tests: shrinks + stays valid JS, no-op without a tag, include coverage                                              |
| `tests/utils.js`         | Shared test helpers: corpus (`collectShaders`/`packages`), detection regexes, `validateGlsl`, `measure` (byte-snap)                     |
| `tests/build-smoke.js`   | Loads built `dist/` (ESM + CJS); asserts exports + transform work                                                                       |
| `tests/run-test.js`      | Manual demo (`node tests/run-test.js`)                                                                                                  |
| `tests/dump-chunks.js`   | Local-only: dumps each shader + every `METHODS` output (with byte savings) to gitignored `chunks.dump.txt`                              |
| `tests/experimental.js`  | Local-only pre-release suite (`bun run tests:next`): every `utils.js` `METHODS` transform measured + GLSL-gated vs the shipped baseline |
| `tests/e2e.js`           | Benchmarks real npm packages → injects README stats table; GLSL validity gate                                                           |
| `tests/validate.js`      | Asserts benchmarked packages still load                                                                                                 |
| `docs/stats.md`          | Explains how the README stats are measured (method only, no live numbers)                                                               |
| `backlog.md`             | Next-up work items, each pointing at the files to read first                                                                            |
| `scripts/publish-npm.sh` | The release flow (`bun run npm:deploy`)                                                                                                 |

## Commands

```sh
bun test            # unit
bun run typecheck   # checks src/index.d.ts (strict)
bun run build       # bundle src/plugin.js -> dist/index.{js,cjs} (+ .d.ts)
bun run test:build  # build, then load dist/ (ESM + CJS) and assert it works
bun run test:e2e    # validate + benchmark real packages, print stats
bun run tests:next  # local-only: run tests/experimental.js method comparison (not in CI)
bun run format      # prettier
bun run npm:deploy  # bump + build + typecheck + test + e2e + commit + tag (GHA publishes)
```

## Things that will bite you

- **Source of truth is `src/` (plain ESM JS).** There is no TS build. Types are hand-maintained in `src/index.d.ts`.
- **Build bundles `src/plugin.js`, not `src/index.js`.** With `sideEffects: false`, bun tree-shakes the pure re-export entry to nothing — so the entry is `plugin.js` renamed to `index.js`. Don't "fix" this back. Because of that, `plugin.js` also re-exports the public core API (`minifyShader`, `extractShaderLiterals`) so `dist` exports match `index.d.ts`. `tests/build-smoke.js` guards this.
- **Runtime deps must be `--external` in the build script** (they're declared in `dependencies`, not bundled). Add a new runtime dep → add it to the `--external` list too.
- **Adding a benchmark package:** `bun add <pkg>` in `tests/`, then append to `PACKAGES` in `tests/e2e.js`. Only packages shipping their _own_ GLSL/WGSL template literals will register; renderers that consume user shaders contribute 0.
- **README stats are generated**, between `<!-- STATS:START/END -->`. Edit `tests/e2e.js`, not the table. The release script runs `e2e --write` then `format` so the committed table stays prettier-clean. The caption is the one place live numbers belong; `docs/stats.md` explains the method and stays version-independent.
- **`tests/e2e.js` is also a validity gate.** It parses every GLSL shader before and after minify with `@shaderfrog/glsl-parser` (a `tests/`-only dep) and exits non-zero if minify breaks one. WGSL and unparseable glslify fragments are skipped, not failed. If you change `minifyShader`, this is what proves you didn't corrupt real shaders.
- **Default `include` is the JS/TS family** (`/\.[mc]?[jt]sx?$/` — covers `.mjs/.cjs/.mts/.cts`), because Babel parses whole files. `.vue`/`.svelte`/`.glsl` won't parse and yield nothing; reaching them is a backlog item (`scan: 'loose'`).
- **`byte-snap`** (the npm dependency) is the stats engine for `outputRatio`. It ships a `require` export from **1.0.5** on, so the CJS build can `require` it — keep the dependency floor at `^1.0.5`. `tests/build-smoke.js` would catch a regression here.
- **Defaults live in `src/defaults.js`.** Tags, include/exclude, the comment-tag regex, and the named `minifyShader` patterns (`RE_BLOCK_COMMENT`, `RE_INLINE_WS`, …) are defined once; the comment-tag regex is derived from the tag list so custom `tags` work in `/* tag */` form too. Don't re-inline these literals in `core.js`/`plugin.js` — reuse the named `RE_*` so future compression candidates in `tests/` and the shipped minifier can't drift.

## Conventions

Prettier-enforced (`format:check` in CI). Match surrounding style. Keep the diff small; deletion over addition.
