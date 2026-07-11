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
import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { format, resolveConfig } from 'prettier';

import { packages } from './utils.js';

const here = dirname(fileURLToPath(import.meta.url));

// Validate the benchmarked libraries actually load before trusting their stats.
execFileSync('node', [resolve(here, 'validate.js')], { stdio: 'inherit' });

// Each package's scan (walk its files, extract shaders, minify, validate) is
// independent — no shared state — so it's fanned out to a worker per package,
// a handful in flight at a time. That's what actually made this benchmark slow:
// a full Babel parse/traverse over every file a big installed tree ships, not
// the validate.js load-check above (~1.5s) or anything measured here.
function scanPackage(pkg, root) {
  return new Promise((res, rej) => {
    const worker = new Worker(resolve(here, 'e2e-worker.js'), { workerData: { pkg, root } });
    worker.once('message', (result) => {
      worker.terminate();
      res(result);
    });
    worker.once('error', rej);
  });
}

async function benchAll(pkgs) {
  const queue = pkgs.filter((pkg) => existsSync(resolve(here, 'node_modules', pkg)));
  const total = queue.length;
  let done = 0;
  const results = [];
  async function drain() {
    let pkg;
    while ((pkg = queue.shift()) !== undefined) {
      const result = await scanPackage(pkg, resolve(here, 'node_modules', pkg));
      done++;
      process.stdout.write(`\r  scanning packages: ${done}/${total} (${pkg})${' '.repeat(20)}`);
      if (result) results.push(result);
    }
  }
  await Promise.all(Array.from({ length: Math.min(cpus().length, queue.length) }, drain));
  process.stdout.write('\n');
  return results;
}

const scanned = await benchAll(packages());

// Proof the minifier preserves meaning: every shader that parses before minify
// (GLSL via @shaderfrog/glsl-parser, WGSL via wgsl_reflect) must still parse
// after. A shader that breaks is a real bug → fatal. Fragments that don't parse
// even *before* minify (glslify chunks missing their #include context, or
// macro-laden WGSL like Babylon.js's `#ifdef`-guarded shaders) are out of scope
// — counted as skipped, not validated.
const validation = { ok: 0, okWgsl: 0, broken: 0, fragments: 0, broke: [] };
for (const { validation: v } of scanned) {
  validation.ok += v.ok;
  validation.okWgsl += v.okWgsl;
  validation.broken += v.broken;
  validation.fragments += v.fragments;
  validation.broke.push(...v.broke);
}

// Raw bytes-saved (byte-snap) per package, up front — it drives both the sort
// and the table, so compute it once per row instead of re-measuring later.
const rows = scanned
  .map((r) => ({ ...r, raw: diff(snap.text(r.before), snap.text(r.after)).json() }))
  .sort((a, b) => b.raw.savedPercent - a.raw.savedPercent); // best saved% first
if (rows.length === 0) {
  console.error('No shaders found. Did you `bun add` the packages in tests/?');
  process.exit(1);
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
  const brNet = `${signed(r.brotli.savedPercent)}%`;
  return line(`\`${r.pkg}\``, r.count, r.raw.beforeBytes, r.raw.afterBytes, r.raw.savedPercent, brNet);
});
const totalLine = line('**Total**', tCount, total.beforeBytes, total.afterBytes, total.savedPercent, '—');
const table = [header, sep, ...body, totalLine].join('\n');

console.log(`\nReal-world shader compression (engine: minifyShader)\n`);
console.log(table);
console.log(`\n→ ${tCount} shaders across ${rows.length} package(s): ${pct(total.savedPercent)}% smaller\n`);

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
  // v.ok/(v.ok + v.broken) would always read N/N — a broken shader aborts the
  // run above before this line runs — so the informative ratio is against the
  // whole corpus (tCount), which shows how much of it is parseable/verified
  // vs. out-of-scope fragments.
  const date = new Date().toISOString().slice(0, 10);
  const caption = `_${v.ok}/${tCount} parseable shaders. ✅ Verified ${date}. [How this is measured](docs/stats.md)_`;
  const block = `<!-- STATS:START -->\n${table}\n\n${caption}\n<!-- STATS:END -->`;
  // Format before diffing against the on-disk file (also prettier-formatted by
  // the last run) — otherwise our hand-padded table never byte-matches the
  // formatted file and this "up to date" check would never fire. Config isn't
  // auto-loaded by the programmatic API (unlike the CLI) — resolve it
  // ourselves or this reformats the whole file with prettier's defaults.
  const config = await resolveConfig(readme);
  const next = await format(md.replace(markers, block), { ...config, filepath: readme });
  if (next === md) {
    console.log('· README stats already up to date');
  } else {
    writeFileSync(readme, next);
    console.log('✓ README stats updated');
  }
}
