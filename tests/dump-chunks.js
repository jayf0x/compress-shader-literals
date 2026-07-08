/**
 * Local-only debug dump: run every compression method (utils.js METHODS) over
 * every shader in the corpus and write each one — original + each method's
 * output, with per-method byte savings — to a single gitignored .txt for manual
 * review. Lets you eyeball where each method wins and whether it's worth it.
 *
 *   cd tests && bun install && node dump-chunks.js
 *
 * Output: tests/chunks.dump.txt (gitignored)
 */
import { diff, snap } from 'byte-snap';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { METHODS, collectShaders } from './utils.js';

const here = dirname(fileURLToPath(import.meta.url));
const SEP = '\n' + '='.repeat(80) + '\n';

const chunks = collectShaders().map(({ pkg, file, src }, index) => {
  const before = snap.text(src);
  const lines = [`index: ${index}`, `package: ${pkg}`, `source: ${file}`, `original: ${before.bytes.total} B`];
  // one summary line per method, then the outputs
  const outputs = [];
  for (const [name, transform] of METHODS) {
    const out = transform(src);
    const { afterBytes, savedPercent } = diff(before, snap.text(out)).json();
    lines.push(`${name}: ${afterBytes} B (saved ${savedPercent.toFixed(1)}%)`);
    outputs.push(`--- ${name} ---`, out, '');
  }
  return [...lines, '', '--- original ---', src, '', ...outputs].join('\n');
});

const out = resolve(here, 'chunks.dump.txt');
const methods = METHODS.map(([n]) => n).join(', ');
const header = `# shader chunk dump — ${chunks.length} chunks — methods: ${methods} — ${new Date().toISOString()}\n`;
writeFileSync(out, header + chunks.join(SEP) + '\n');
console.log(`✓ wrote ${chunks.length} chunks (${methods}) → ${out}`);
