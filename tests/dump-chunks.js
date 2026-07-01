/**
 * Local-only debug dump: run `minifyShader` over every shader in the corpus and
 * write each one — before + after — to a single gitignored .txt for manual
 * review. Use it to eyeball whether the minifier is leaving bytes on the table.
 *
 *   cd tests && bun install && node dump-chunks.js
 *
 * Output: tests/chunks.dump.txt (gitignored)
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { minifyShader } from '../src/core.js';
import { collectShaders } from './utils.js';

const here = dirname(fileURLToPath(import.meta.url));
const SEP = '\n' + '='.repeat(80) + '\n';

const chunks = collectShaders().map(({ pkg, file, src }, index) => {
  const min = minifyShader(src);
  const before = Buffer.byteLength(src);
  const after = Buffer.byteLength(min);
  const ratio = before === 0 ? 0 : ((before - after) / before) * 100;
  return [
    `index: ${index}`,
    `package: ${pkg}`,
    `source: ${file}`,
    `before minify: ${before}`,
    `after minify: ${after}`,
    `saved: ${ratio.toFixed(1)}%`,
    `compressed: ${after < before ? 'yes' : 'no'}`,
    '',
    '--- before ---',
    src,
    '',
    '--- after ---',
    min,
  ].join('\n');
});

const out = resolve(here, 'chunks.dump.txt');
const header = `# shader chunk dump — ${chunks.length} chunks — ${new Date().toISOString()}\n`;
writeFileSync(out, header + chunks.join(SEP) + '\n');
console.log(`✓ wrote ${chunks.length} chunks → ${out}`);
