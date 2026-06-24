# AGENTS.md

## What this is

A universal bundler plugin (built on [unplugin](https://github.com/unjs/unplugin)) that minifies GLSL/WGSL shader **template literals** in source at build time — strips comments, collapses whitespace — before the host bundler runs. Published to npm as `compress-shader-literals`.

Intent: stay tiny and boring. This is a one-job tool. Resist scope creep.

## Layout

| Path                     | Role                                                             |
| ------------------------ | ---------------------------------------------------------------- |
| `src/core.js`            | The engine: `extractShaderLiterals` (Babel AST) + `minifyShader` |
| `src/plugin.js`          | unplugin wrapper; `outputRatio` stats via `byte-snap`            |
| `src/index.js`           | Re-export entry                                                  |
| `src/index.d.ts`         | Hand-written types (no TS build — copied to `dist/` on build)    |
| `src/core.test.js`       | Unit tests (`bun test`)                                          |
| `src/run-test.js`        | Manual demo (`node src/run-test.js`)                             |
| `tests/e2e.js`           | Benchmarks real npm packages → injects README stats table        |
| `tests/validate.js`      | Asserts benchmarked packages still load                          |
| `scripts/publish-npm.sh` | The release flow (`bun run npm:deploy`)                          |

## Commands

```sh
bun test            # unit
bun run typecheck   # checks src/index.d.ts (strict)
bun run build       # bundle src/plugin.js -> dist/index.js (+ .d.ts, gzip/br)
bun run test:e2e    # validate + benchmark real packages, print stats
bun run format      # prettier
bun run npm:deploy  # bump + build + typecheck + test + e2e + commit + tag (GHA publishes)
```

## Things that will bite you

- **Source of truth is `src/` (plain ESM JS).** There is no TS build. Types are hand-maintained in `src/index.d.ts`.
- **Build bundles `src/plugin.js`, not `src/index.js`.** With `sideEffects: false`, bun tree-shakes the pure re-export entry to nothing — so the entry is `plugin.js` renamed to `index.js`. Don't "fix" this back.
- **Runtime deps must be `--external` in the build script** (they're declared in `dependencies`, not bundled). Add a new runtime dep → add it to the `--external` list too.
- **Adding a benchmark package:** `bun add <pkg>` in `tests/`, then append to `PACKAGES` in `tests/e2e.js`. Only packages shipping their _own_ GLSL/WGSL template literals will register; renderers that consume user shaders contribute 0.
- **README stats are generated**, between `<!-- STATS:START/END -->`. Edit `tests/e2e.js`, not the table. The release script runs `e2e --write` then `format` so the committed table stays prettier-clean.
- **`byte-snap`** (a sibling package, now on npm) is the stats engine for `outputRatio`. A local `./byte-snap/` folder may exist gitignored — ignore it; the dependency is the npm one.

## Conventions

Prettier-enforced (`format:check` in CI). Match surrounding style. Keep the diff small; deletion over addition.
