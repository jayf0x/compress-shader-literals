/**
 * One package's scan, run off the main thread — see e2e.js. Each package is
 * independent (no shared state) so this is the whole unit of parallelism.
 */
import { diff, snap } from 'byte-snap';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parentPort, workerData } from 'node:worker_threads';
import { brotliCompressSync } from 'node:zlib';

import { minifyShader } from '../src/core.js';
import { isWGSL, jsFiles, shadersInCode, validateGlsl } from './utils.js';

const { pkg, root, shaderMinify } = workerData;

// Optional: unplugin-shader-minifier (https://github.com/jayf0x/shader-minifier-plugin), a
// sibling repo, not published to npm — checked out next to this one as a dev tool, never a
// hard dependency. Missing repo/binary/mono just skips the sample, same as a broken shader
// falling back inside createLiteralTransform itself.
const SM_ENTRY = resolvePath(dirname(fileURLToPath(import.meta.url)), '../../shader-minifier-plugin/dist/index.js');

let smTransform = null;
if (shaderMinify && existsSync(SM_ENTRY)) {
  try {
    const { createLiteralTransform } = await import(SM_ENTRY);
    smTransform = createLiteralTransform({ fallback: minifyShader });
  } catch {
    smTransform = null;
  }
}

let before = '';
let after = '';
let count = 0;
let smBefore = '';
let smAfter = '';
let smCount = 0;
let smMs = 0;
const validation = { ok: 0, okWgsl: 0, broken: 0, fragments: 0, broke: [] };

for (const file of jsFiles(root)) {
  for (const shader of shadersInCode(readFileSync(file, 'utf8'))) {
    const min = minifyShader(shader);
    before += shader;
    after += min;
    count++;
    switch (validateGlsl(shader, min)) {
      case 'ok':
        validation.ok++;
        if (isWGSL(shader)) validation.okWgsl++;
        break;
      case 'broken':
        validation.broken++;
        validation.broke.push(pkg);
        break;
      case 'fragment':
        validation.fragments++;
        break;
    }

    if (smTransform) {
      const t0 = performance.now();
      let smMin;
      try {
        smMin = smTransform(shader);
      } catch {
        smMin = min; // never fail the run over a shader_minifier hiccup
      }
      smMs += performance.now() - t0;
      smBefore += shader;
      smAfter += smMin;
      smCount++;
    }
  }
}

// Brotli here too, not just raw diff — one package's worth of text at a time,
// in parallel with every other package's worker, instead of the main thread
// doing it serially after every package is already back. That parallelism is
// what makes a full-corpus brotli pass affordable (was previously sampled to
// the top 5 packages to avoid a slow single-threaded tail).
const brotli = count
  ? diff(snap.buffer(brotliCompressSync(before)), snap.buffer(brotliCompressSync(after))).json()
  : null;

const sm = smCount ? { count: smCount, before: smBefore, after: smAfter, ms: smMs, sampled: smCount < count } : null;

parentPort.postMessage(count ? { pkg, count, before, after, validation, brotli, sm } : null);
