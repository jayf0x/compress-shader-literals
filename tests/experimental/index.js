/**
 * Experimental (pre-release) test runner — LOCAL ONLY, not wired into CI.
 *
 *   bun run tests:next
 *
 * Drop a `*.exp.js` in this folder exporting { name, transform } to prototype a
 * new compression flow. The runner drives every candidate over the real shader
 * corpus, compares its output against the shipped `minifyShader` baseline
 * (bytes: raw / gzip / brotli via byte-snap), and validates every GLSL shader
 * still parses after the transform. Nothing here changes src/ — prove it here
 * first, then graduate a win into src/core.js (see backlog.md).
 */
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { minifyShader } from '../../src/core.js';
import { collectShaders, measure, validateGlsl } from './utils.js';

const here = dirname(fileURLToPath(import.meta.url));

const baseline = { name: 'minifyShader (current)', transform: minifyShader };

const candidates = [];
for (const f of readdirSync(here)) {
  if (!f.endsWith('.exp.js')) continue;
  const mod = await import(join(here, f));
  if (typeof mod.transform === 'function') candidates.push({ name: mod.name || f, transform: mod.transform });
}

const shaders = collectShaders();
console.log(`\nExperimental suite — ${shaders.length} shaders, ${candidates.length} candidate(s) vs baseline\n`);

function run(transform) {
  let before = '';
  let after = '';
  const v = { ok: 0, broken: 0, wgsl: 0, fragment: 0, broke: [] };
  for (const { pkg, src } of shaders) {
    const out = transform(src);
    before += src;
    after += out;
    const verdict = validateGlsl(src, out);
    v[verdict]++;
    if (verdict === 'broken') v.broke.push(pkg);
  }
  return { m: measure(before, after), v };
}

const pct = (n) => `${n.toFixed(1)}%`;
const row = (name, m) =>
  `${name.padEnd(26)} raw ${pct(m.rawSavedPct).padStart(6)}  gzip ${pct(m.gzSavedPct).padStart(6)}  brotli ${pct(m.brSavedPct).padStart(6)}  (raw ${m.rawBefore}→${m.rawAfter} B)`;

const results = [baseline, ...candidates].map((c) => ({ name: c.name, ...run(c.transform) }));

console.log('Compression (saved vs original):');
for (const r of results) console.log('  ' + row(r.name, r.m));

console.log('\nValidity (GLSL parses after transform):');
let failed = false;
for (const r of results) {
  const { ok, broken, wgsl, fragment } = r.v;
  const flag = broken > 0 ? '✗' : '✓';
  if (broken > 0) failed = true;
  console.log(`  ${flag} ${r.name.padEnd(26)} ${ok} ok · ${broken} broken · ${wgsl} wgsl · ${fragment} fragment`);
  if (broken > 0) console.log(`      broke in: ${[...new Set(r.v.broke)].join(', ')}`);
}

// Marginal win of each candidate over baseline (what graduating it would buy).
const base = results[0].m;
if (results.length > 1) {
  console.log('\nMarginal vs baseline:');
  for (const r of results.slice(1)) {
    const dRaw = base.rawAfter - r.m.rawAfter;
    const dBr = base.brAfter - r.m.brAfter;
    console.log(`  ${r.name.padEnd(26)} raw ${dRaw > 0 ? '-' : '+'}${Math.abs(dRaw)} B  brotli ${dBr > 0 ? '-' : '+'}${Math.abs(dBr)} B`);
  }
}

console.log();
if (failed) {
  console.error('A candidate broke a shader that parsed before — not safe to graduate.\n');
  process.exit(1);
}
