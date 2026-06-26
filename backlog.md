# Backlog

- [ ] **Drop the lazy `byte-snap` import once a new version is released.**
      [src/plugin.js](src/plugin.js) loads byte-snap via `await import('byte-snap')`
      inside an async `buildEnd` because the published `byte-snap@1.0.3` is ESM-only
      and a top-level `import` breaks our CJS build (`require('byte-snap')` →
      `ERR_PACKAGE_PATH_NOT_EXPORTED`).
      The local `byte-snap` repo (v1.0.4+) now ships dual ESM/CJS exports. After it's
      published, bump the dependency and revert `buildEnd` to a plain top-level
      `import { diff, snap } from 'byte-snap'` (drop the `async`/dynamic import).
      Guard: `tests/build-smoke.js` must still pass for both ESM and CJS.
