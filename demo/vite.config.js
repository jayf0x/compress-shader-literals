import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const stubs = fileURLToPath(new URL('./src/plugin-stubs.js', import.meta.url));

// WebContainers need cross-origin isolation (COOP/COEP) to use SharedArrayBuffer.
// Dev server sets the headers directly; the built site can't (GitHub Pages serves
// no custom headers), so index.html registers coi-serviceworker.js instead.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/compress-shader-literals/' : '/',
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  resolve: {
    alias: {
      // See src/plugin-stubs.js — Node-only half of compress-shader-literals'
      // bundle that the demo never calls, stubbed out for the browser build.
      '@rollup/pluginutils': stubs,
      unplugin: stubs,
      'byte-snap': stubs,
      'magic-string': stubs,
    },
  },
});
