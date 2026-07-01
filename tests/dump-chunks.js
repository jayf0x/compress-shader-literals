/**
 * Local-only debug dump: run `minifyShader` over every shader literal shipped in
 * the benchmarked packages and write each one — before + after — to a single
 * gitignored .txt for manual review. Use it to eyeball whether the minifier is
 * leaving compression on the table.
 *
 *   cd tests && bun install && node dump-chunks.js
 *
 * Output: tests/chunks.dump.txt (gitignored)
 */
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { minifyShader } from '../src/core.js';

const traverse = _traverse.default || _traverse;
const here = dirname(fileURLToPath(import.meta.url));

const PACKAGES = ['three', '@jayf0x/fluidity-js', 'ogl', 'shader-park-core', 'curtainsjs'];
const SHADER_SIGNAL = /\b(gl_FragColor|gl_Position|void\s+main|precision\s+(highp|mediump|lowp)|fn\s+main)\b/;

function jsFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) jsFiles(full, out);
    else if (/\.(js|mjs|cjs)$/.test(name)) out.push(full);
  }
  return out;
}

function shadersIn(code) {
  const found = [];
  let ast;
  try {
    ast = parse(code, { sourceType: 'unambiguous', plugins: ['typescript', 'jsx'] });
  } catch {
    return found;
  }
  traverse(ast, {
    TemplateLiteral(path) {
      const raw = path.node.quasis.map((q) => q.value.raw).join('');
      if (SHADER_SIGNAL.test(raw)) found.push(raw);
    },
  });
  return found;
}

const SEP = '\n' + '='.repeat(80) + '\n';
const chunks = [];
let index = 0;

for (const pkg of PACKAGES) {
  const root = resolve(here, 'node_modules', pkg);
  if (!existsSync(root)) continue;
  for (const file of jsFiles(root)) {
    for (const shader of shadersIn(readFileSync(file, 'utf8'))) {
      const min = minifyShader(shader);
      const before = Buffer.byteLength(shader);
      const after = Buffer.byteLength(min);
      const ratio = before === 0 ? 0 : ((before - after) / before) * 100;
      chunks.push(
        [
          `index: ${index++}`,
          `package: ${pkg}`,
          `source: ${file.slice(root.length + 1)}`,
          `before minify: ${before}`,
          `after minify: ${after}`,
          `saved: ${ratio.toFixed(1)}%`,
          `compressed: ${after < before ? 'yes' : 'no'}`,
          '',
          '--- before ---',
          shader,
          '',
          '--- after ---',
          min,
        ].join('\n'),
      );
    }
  }
}

if (chunks.length === 0) {
  console.error('No shaders found. Did you `bun add` the packages in tests/?');
  process.exit(1);
}

const out = resolve(here, 'chunks.dump.txt');
const header = `# shader chunk dump — ${chunks.length} chunks — ${new Date().toISOString()}\n`;
writeFileSync(out, header + chunks.join(SEP) + '\n');
console.log(`✓ wrote ${chunks.length} chunks → ${out}`);
