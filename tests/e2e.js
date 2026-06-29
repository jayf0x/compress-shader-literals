/**
 * Local-only e2e: run the real `minifyShader` engine against shaders shipped in
 * real npm packages, then report aggregate savings and inject them into README.
 *
 *   cd tests && bun install && node e2e.js [--write]
 *
 * Add more packages to PACKAGES — each one `bun add`ed here — to grow the stats.
 */
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import glsl from '@shaderfrog/glsl-parser';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { minifyShader } from '../src/core.js';

const traverse = _traverse.default || _traverse;
const here = dirname(fileURLToPath(import.meta.url));

// Validate the benchmarked libraries actually load before trusting their stats.
execFileSync('node', [resolve(here, 'validate.js')], { stdio: 'inherit' });

// Packages to benchmark — `bun add` each in tests/ first.
const PACKAGES = ['three', '@jayf0x/fluidity-js', 'ogl', 'shader-park-core', 'curtainsjs'];

// A template literal is "a shader" if its text looks like GLSL/WGSL.
const SHADER_SIGNAL = /\b(gl_FragColor|gl_Position|void\s+main|precision\s+(highp|mediump|lowp)|fn\s+main)\b/;

// WGSL has no GLSL parser to check it against — detect it so we don't feed it to
// the GLSL parser and report it as "not parse-validated" instead of a failure.
const isWGSL = (src) => /@vertex|@fragment|@group|var<|@compute/.test(src) && !/void\s+main/.test(src);

// Proof the minifier preserves meaning: every GLSL shader that parses before
// minify must still parse after. A shader that breaks is a real bug → fatal.
// Fragments that don't parse even *before* minify (glslify chunks missing their
// #include context) are out of scope — counted as skipped, not validated.
const validation = { glslOk: 0, broken: 0, wgsl: 0, fragments: 0, broke: [] };
function validate(pkg, before, after) {
  if (isWGSL(before)) {
    validation.wgsl++;
    return;
  }
  try {
    glsl.parser.parse(before, { quiet: true });
  } catch {
    validation.fragments++;
    return;
  }
  try {
    glsl.parser.parse(after, { quiet: true });
    validation.glslOk++;
  } catch (err) {
    validation.broken++;
    validation.broke.push(`${pkg}: ${err.message.split('\n')[0]}`);
  }
}

// ponytail: regex file walk, plain template-literal heuristic. Good enough for a
// stats demo; tighten if a package ships shaders we systematically miss.
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

function benchPackage(pkg) {
  const root = resolve(here, 'node_modules', pkg);
  if (!existsSync(root)) return null;
  let before = 0;
  let after = 0;
  let count = 0;
  for (const file of jsFiles(root)) {
    for (const shader of shadersIn(readFileSync(file, 'utf8'))) {
      const min = minifyShader(shader);
      before += Buffer.byteLength(shader);
      after += Buffer.byteLength(min);
      count++;
      validate(pkg, shader, min);
    }
  }
  return count ? { pkg, count, before, after } : null;
}

const rows = PACKAGES.map(benchPackage).filter(Boolean);
if (rows.length === 0) {
  console.error('No shaders found. Did you `bun add` the packages in tests/?');
  process.exit(1);
}

const pct = (b, a) => (b === 0 ? 0 : ((b - a) / b) * 100).toFixed(1);
const tBefore = rows.reduce((s, r) => s + r.before, 0);
const tAfter = rows.reduce((s, r) => s + r.after, 0);
const tCount = rows.reduce((s, r) => s + r.count, 0);

const header = '| Package | Shaders | Before | After | Saved |';
const sep = '| ------- | ------: | -----: | ----: | ----: |';
const line = (name, count, b, a) =>
  `| ${name} | ${count} | ${b.toLocaleString()} B | ${a.toLocaleString()} B | **${pct(b, a)}%** |`;
const body = rows.map((r) => line(`\`${r.pkg}\``, r.count, r.before, r.after));
const total = line('**Total**', tCount, tBefore, tAfter);
const table = [header, sep, ...body, total].join('\n');

console.log(`\nReal-world shader compression (engine: minifyShader)\n`);
console.log(table);
console.log(`\n→ ${tCount} shaders across ${rows.length} package(s): ${pct(tBefore, tAfter)}% smaller\n`);

// Validation gate: minify must not break a shader that parsed before.
const v = validation;
console.log('Validity check (@shaderfrog/glsl-parser):');
console.log(`  ✓ ${v.glslOk} GLSL shaders parse before AND after minify (${v.broken} broken)`);
console.log(`  · ${v.wgsl} WGSL — no GLSL parser to validate against (skipped)`);
console.log(`  · ${v.fragments} fragments unparseable before minify (glslify chunks — skipped)\n`);
if (v.broken > 0) {
  console.error(`✗ minify broke ${v.broken} shader(s) that were valid before:`);
  for (const b of v.broke.slice(0, 10)) console.error('    ' + b);
  process.exit(1);
}

// One honest, machine-checked line for the README caption.
const validityNote = `${v.glslOk}/${v.glslOk + v.broken} parseable GLSL verified valid after minify`;

if (process.argv.includes('--write')) {
  const readme = resolve(here, '..', 'README.md');
  const md = readFileSync(readme, 'utf8');
  const date = new Date().toISOString().slice(0, 10);
  const caption = `_${tCount} shaders · ${validityNote} · [how this is measured](docs/stats.md) · ${date}_`;
  const block = `<!-- STATS:START -->\n${table}\n\n${caption}\n<!-- STATS:END -->`;
  const next = md.replace(/<!-- STATS:START -->[\s\S]*?<!-- STATS:END -->/, block);
  if (next === md) {
    console.error('No <!-- STATS:START/END --> markers found in README.');
    process.exit(1);
  }
  writeFileSync(readme, next);
  console.log('✓ README stats updated');
}
