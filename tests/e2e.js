/**
 * Local-only e2e: run the real `minifyShader` engine against shaders shipped in
 * real npm packages, then report aggregate savings and inject them into README.
 *
 *   cd tests && bun install && node e2e.js [--write]
 *
 * Add more packages to PACKAGES — each one `bun add`ed here — to grow the stats.
 */
import { diff, snap } from 'byte-snap';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync } from 'node:zlib';

import { minifyShader } from '../src/core.js';
import { isWGSL, jsFiles, packages, shadersInCode, validateGlsl } from './utils.js';

const here = dirname(fileURLToPath(import.meta.url));

// Validate the benchmarked libraries actually load before trusting their stats.
execFileSync('node', [resolve(here, 'validate.js')], { stdio: 'inherit' });

// Proof the minifier preserves meaning: every shader that parses before minify
// (GLSL via @shaderfrog/glsl-parser, WGSL via wgsl_reflect) must still parse
// after. A shader that breaks is a real bug → fatal. Fragments that don't parse
// even *before* minify (glslify chunks missing their #include context, or
// macro-laden WGSL like Babylon.js's `#ifdef`-guarded shaders) are out of scope
// — counted as skipped, not validated.
const validation = { ok: 0, okWgsl: 0, broken: 0, fragments: 0, broke: [] };
function validate(pkg, before, after) {
  switch (validateGlsl(before, after)) {
    case 'ok':
      validation.ok++;
      if (isWGSL(before)) validation.okWgsl++;
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

function benchPackage(pkg) {
  const root = resolve(here, 'node_modules', pkg);
  if (!existsSync(root)) return null;
  // Keep the raw text around (not just byte counts) so the top packages can
  // also be brotli-compressed as one blob further down — what actually ships.
  let before = '';
  let after = '';
  let count = 0;
  for (const file of jsFiles(root)) {
    for (const shader of shadersInCode(readFileSync(file, 'utf8'))) {
      const min = minifyShader(shader);
      before += shader;
      after += min;
      count++;
      validate(pkg, shader, min);
    }
  }
  if (!count) return null;
  return { pkg, count, before, after };
}

// Raw bytes-saved (byte-snap) per package, up front — it drives both the sort
// and the table, so compute it once per row instead of re-measuring later.
const rows = packages()
  .map(benchPackage)
  .filter(Boolean)
  .map((r) => ({ ...r, raw: diff(snap.text(r.before), snap.text(r.after)).json() }))
  .sort((a, b) => b.raw.savedPercent - a.raw.savedPercent); // best saved% first
if (rows.length === 0) {
  console.error('No shaders found. Did you `bun add` the packages in tests/?');
  process.exit(1);
}

// Brotli-compressing every package's shaders (some are 100s of KB) at Node's
// default max quality is what actually made this benchmark slow — not the
// GLSL validation above. We only care whether the top savers still win after
// compression, so only brotli-check those; leave the rest blank rather than
// pay for a number nobody needs.
const BROTLI_SAMPLE = 5;
for (const r of rows.slice(0, BROTLI_SAMPLE)) {
  r.brotli = diff(snap.buffer(brotliCompressSync(r.before)), snap.buffer(brotliCompressSync(r.after))).json();
}

const pct = (n) => n.toFixed(1);
const signed = (n) => (n >= 0 ? `+${pct(n)}` : pct(n));
const tCount = rows.reduce((s, r) => s + r.count, 0);
// Sum of the already-computed per-row byte-snap stats — same totals a
// snap.text() over the whole corpus would give, without re-scanning it.
const total = diff(
  { bytes: { total: rows.reduce((s, r) => s + r.raw.beforeBytes, 0) }, files: tCount },
  { bytes: { total: rows.reduce((s, r) => s + r.raw.afterBytes, 0) }, files: tCount }
).json();

const header = '| Package | Shaders | Before | After | Saved | Net after Brotli |';
const sep = '| ------- | ------: | -----: | ----: | ----: | ---------------: |';
const line = (name, count, b, a, savedPct, brNet) =>
  `| ${name} | ${count} | ${b.toLocaleString()} B | ${a.toLocaleString()} B | **${pct(savedPct)}%** | ${brNet} |`;
const body = rows.map((r) => {
  const brNet = r.brotli === undefined ? '—' : `${signed(r.brotli.savedPercent)}%`;
  return line(`\`${r.pkg}\``, r.count, r.raw.beforeBytes, r.raw.afterBytes, r.raw.savedPercent, brNet);
});
const totalLine = line('**Total**', tCount, total.beforeBytes, total.afterBytes, total.savedPercent, '—');
const table = [header, sep, ...body, totalLine].join('\n');

console.log(`\nReal-world shader compression (engine: minifyShader)\n`);
console.log(table);
console.log(`\n→ ${tCount} shaders across ${rows.length} package(s): ${pct(total.savedPercent)}% smaller\n`);
console.log(`(Net after Brotli shown for the top ${BROTLI_SAMPLE} packages only — the rest are "—")\n`);

// Validation gate: minify must not break a shader that parsed before.
const v = validation;
console.log('Validity check (@shaderfrog/glsl-parser + wgsl_reflect):');
console.log(
  `  ✓ ${v.ok} shaders parse before AND after minify (${v.ok - v.okWgsl} GLSL, ${v.okWgsl} WGSL) — ${v.broken} broken`
);
console.log(`  · ${v.fragments} fragments unparseable before minify (glslify/macro chunks — skipped)\n`);
if (v.broken > 0) {
  console.error(`✗ minify broke ${v.broken} shader(s) that were valid before:`);
  for (const b of v.broke.slice(0, 10)) console.error('    ' + b);
  process.exit(1);
}

// One honest, machine-checked line for the README caption. v.ok/(v.ok + v.broken)
// would always read N/N — a broken shader aborts the run above before this line
// runs — so the informative ratio is against the whole corpus (tCount), which
// shows how much of it is parseable and verified vs. out-of-scope fragments.
const validityNote = `${v.ok}/${tCount} parseable shaders (GLSL + WGSL) verified valid after minify`;

if (process.argv.includes('--write')) {
  const readme = resolve(here, '..', 'README.md');
  const md = readFileSync(readme, 'utf8');
  const markers = /<!-- STATS:START -->[\s\S]*?<!-- STATS:END -->/;
  // Only a genuinely missing marker block is fatal — identical content just means
  // nothing changed since the last run, which is fine (idempotent re-run).
  if (!markers.test(md)) {
    console.error('No <!-- STATS:START/END --> markers found in README.');
    process.exit(1);
  }
  const date = new Date().toISOString().slice(0, 10);
  const caption = `_${tCount} shaders · ${validityNote} · [how this is measured](docs/stats.md) · ${date}_`;
  const block = `<!-- STATS:START -->\n${table}\n\n${caption}\n<!-- STATS:END -->`;
  const next = md.replace(markers, block);
  if (next === md) {
    console.log('· README stats already up to date');
  } else {
    writeFileSync(readme, next);
    console.log('✓ README stats updated');
  }
}
