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
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { taglifyFile } from 'taglify';

import { packages } from './utils.js';

const here = dirname(fileURLToPath(import.meta.url));

// Validate the benchmarked libraries actually load before trusting their stats.
execFileSync('node', [resolve(here, 'validate.js')], { stdio: 'inherit' });

// A package's scan is pure: same installed version + same scan/minify logic
// always produces the same result. Cache it on disk so re-runs (dev
// iterating on the table/README) skip re-parsing every file of packages that
// haven't changed. Keyed on the installed version *and* a hash of the files
// that drive the scan, so bumping a dependency or editing minifyShader
// invalidates exactly the entries it affects — stale entries are just never
// read again, no eviction needed for a gitignored local cache.
const cacheDir = resolve(here, '.cache');
const logicHash = createHash('sha1')
  .update(
    ['../src/core.js', '../src/defaults.js', 'utils.js', 'e2e-worker.js']
      .map((f) => readFileSync(resolve(here, f), 'utf8'))
      .join('\0')
  )
  .digest('hex')
  .slice(0, 12);

function cacheFile(pkg, root) {
  const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const safe = pkg.replace(/\//g, '__');
  return resolve(cacheDir, `${safe}@${version}--${logicHash}.json`);
}

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
  mkdirSync(cacheDir, { recursive: true });
  async function drain() {
    let pkg;
    while ((pkg = queue.shift()) !== undefined) {
      const root = resolve(here, 'node_modules', pkg);
      const cached = cacheFile(pkg, root);
      let result;
      let hit = false;
      if (existsSync(cached)) {
        result = JSON.parse(readFileSync(cached, 'utf8'));
        hit = true;
      } else {
        result = await scanPackage(pkg, root);
        if (result) writeFileSync(cached, JSON.stringify(result));
      }
      done++;
      process.stdout.write(`\r  scanning packages: ${done}/${total} (${pkg}${hit ? ', cached' : ''})${' '.repeat(20)}`);
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
  const date = new Date().toISOString().slice(0, 10);
  const caption = `_${v.ok}/${tCount} parseable shaders. ✅ Verified ${date}. [How this is measured](docs/stats.md)_`;
  taglifyFile(readme, { STATS: `${table}\n\n${caption}` });
  execFileSync(resolve(here, '..', 'node_modules', '.bin', 'prettier'), ['--write', readme]);
  console.log('✓ README stats updated');
}
