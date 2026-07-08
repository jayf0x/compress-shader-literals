/**
 * Experimental (pre-release) suite — LOCAL ONLY, not wired into CI.
 *
 *   bun run tests:next
 *
 * Runs every method in utils.js `METHODS` over the real shader corpus, reports
 * bytes saved (raw / gzip / brotli via byte-snap) and the marginal win of each
 * candidate over the shipped baseline, and fails if any method breaks a GLSL or
 * WGSL shader that parsed before. Nothing here changes src/ — prove a win here,
 * then graduate it into src/core.js (see backlog.md). Add a method in utils.js.
 */
import { METHODS, collectShaders, measure, validateGlsl } from './utils.js';

const shaders = collectShaders();
console.log(`\nExperimental suite — ${shaders.length} shaders, ${METHODS.length} method(s)\n`);

function run(transform) {
  let before = '';
  let after = '';
  const v = { ok: 0, broken: 0, fragment: 0, broke: [] };
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
const results = METHODS.map(([name, transform]) => ({ name, ...run(transform) }));

console.log('Compression (saved vs original):');
for (const { name, m } of results) {
  console.log(
    `  ${name.padEnd(20)} raw ${pct(m.rawSavedPct).padStart(6)}  gzip ${pct(m.gzSavedPct).padStart(6)}  brotli ${pct(m.brSavedPct).padStart(6)}  (raw ${m.rawBefore}→${m.rawAfter} B)`
  );
}

console.log('\nValidity (GLSL parses after transform):');
let failed = false;
for (const { name, v } of results) {
  if (v.broken > 0) failed = true;
  console.log(
    `  ${v.broken > 0 ? '✗' : '✓'} ${name.padEnd(20)} ${v.ok} ok · ${v.broken} broken · ${v.fragment} fragment`
  );
  if (v.broken > 0) console.log(`      broke in: ${[...new Set(v.broke)].join(', ')}`);
}

// Marginal win of each candidate over the shipped baseline (first method).
const base = results[0].m;
if (results.length > 1) {
  console.log(`\nMarginal vs ${results[0].name}:`);
  for (const { name, m } of results.slice(1)) {
    const dRaw = base.rawAfter - m.rawAfter;
    const dBr = base.brAfter - m.brAfter;
    console.log(
      `  ${name.padEnd(20)} raw ${dRaw >= 0 ? '-' : '+'}${Math.abs(dRaw)} B  brotli ${dBr >= 0 ? '-' : '+'}${Math.abs(dBr)} B`
    );
  }
}

console.log();
if (failed) {
  console.error('A method broke a shader that parsed before — not safe to graduate.\n');
  process.exit(1);
}
