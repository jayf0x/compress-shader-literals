// Runs inside the WebContainer, against a real `npm install`ed package.
// Same shape as tests/e2e-worker.js in the main repo, trimmed to one file:
// walk the package's JS, pull out template literals that read as a shader,
// minify with the real published package, report bytes saved.
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import { minifyShader } from 'compress-shader-literals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const traverse = _traverse.default || _traverse;
const pkg = process.argv[2];
const root = join('node_modules', pkg);

const SHADER_SIGNAL = /\b(gl_FragColor|gl_Position|void\s+main|precision\s+(highp|mediump|lowp)|fn\s+main)\b/;
const JS_FILE = /\.(js|mjs|cjs)$/;

function jsFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) jsFiles(full, out);
    else if (JS_FILE.test(name)) out.push(full);
  }
  return out;
}

function shadersInCode(code) {
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

let before = 0;
let after = 0;
let count = 0;
const samples = [];

for (const file of jsFiles(root)) {
  for (const shader of shadersInCode(readFileSync(file, 'utf8'))) {
    const min = minifyShader(shader);
    before += Buffer.byteLength(shader);
    after += Buffer.byteLength(min);
    count++;
    if (samples.length < 3) samples.push({ file: file.slice(root.length + 1), before: shader, after: min });
  }
}

console.log('__RESULT__' + JSON.stringify({ count, before, after, samples }));
