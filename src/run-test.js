import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { compressShaderLiterals } from './index.js';

const plugin = compressShaderLiterals.vite({ outputRatio: true });

const targetFile = resolve(import.meta.dirname, '../src/core/shaders.ts');
const code = readFileSync(targetFile, 'utf8');

console.log('--- compress-shader-literals ---');
console.log('input:', targetFile);
console.log('input size:', code.length, 'bytes\n');

const result = plugin.transform(code, targetFile);

if (result) {
  console.log('output size:', result.code.length, 'bytes');
  console.log(`saved: ${code.length - result.code.length} bytes`);
  plugin.buildEnd();
} else {
  console.log('no changes (nothing to compress)');
}
