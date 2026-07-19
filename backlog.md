# Backlog

Each item points at the files to read first. Research before building.

## Expand the test corpus beyond npm

files: `tests/utils.js` (`collectShaders`, `packages`), `tests/e2e.js`

why: the corpus is npm packages that ship shaders as JS template literals — but that's only ~40–60% of real-world shader code. The rest lives where today's scanner can't reach:

- GitHub shader repos
- engine `/shaders/` folders
- examples directories
- CDN snippets (Hydra, ShaderToy, etc.)

goal: broaden the corpus so the stats and validity gate reflect real usage, not just npm. Needs a file-based corpus path, not the `dependencies` + import route — same gap `scan: 'loose'` benchmarking would hit (raw `.glsl`/`.wesl` files, e.g. `lygia`, aren't reachable via npm `import()` and are mostly `#include`-style fragments that won't pass `SHADER_SIGNAL` anyway).

note: this is about coverage of shader _sources_ the scanner can reach — it's not the explanation for a package showing 0% saved in the README table. Checked `postprocessing` (**0.0%**) directly: all 136 of its shaders are extracted correctly (matches its real shader count), `minifyShader` runs on every one — there's just nothing left to strip. The npm package ships only its `build/` bundle (no `src/`), which is already pre-minified upstream: one statement per line, no comments, no incidental whitespace. That's an honest, correct 0%, not a detection gap. Worth a one-line callout in `docs/stats.md` if this comes up again, so a low/0% row isn't misread as a bug.
