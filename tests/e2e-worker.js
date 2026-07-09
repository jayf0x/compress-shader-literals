/**
 * One package's scan, run off the main thread — see e2e.js. Each package is
 * independent (no shared state) so this is the whole unit of parallelism.
 */
import { readFileSync } from 'node:fs';
import { parentPort, workerData } from 'node:worker_threads';

import { minifyShader } from '../src/core.js';
import { isWGSL, jsFiles, shadersInCode, validateGlsl } from './utils.js';

const { pkg, root } = workerData;

let before = '';
let after = '';
let count = 0;
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
  }
}

parentPort.postMessage(count ? { pkg, count, before, after, validation } : null);
