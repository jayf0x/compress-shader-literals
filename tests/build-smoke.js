/**
 * Build smoke test: the published `dist/` must actually be usable.
 *
 *   bun run build && node tests/build-smoke.js
 *
 * Guards the regression where `sideEffects` tree-shook the entry to nothing and
 * the package exported undefined. Loads BOTH published entries (ESM + CJS),
 * checks the exports exist, and runs a real transform end to end.
 */
import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '..', 'dist');

const code = 'const v = /* glsl */ `\n  // comment\n  void   main() {}\n`;';

function check(label, mod) {
  assert.equal(typeof mod.compressShaderLiterals?.raw, 'function', `${label}: compressShaderLiterals missing`);
  assert.equal(typeof mod.minifyShader, 'function', `${label}: minifyShader missing`);
  assert.equal(typeof mod.extractShaderLiterals, 'function', `${label}: extractShaderLiterals missing`);

  const plugin = mod.compressShaderLiterals.raw({});
  const out = plugin.transform(code, 'demo.js');
  assert.ok(out && out.code.length < code.length, `${label}: transform did not compress`);
  assert.ok(!out.code.includes('// comment'), `${label}: comment not stripped`);
  console.log(`  ✓ ${label} — exports usable, transform works`);
}

console.log('\nBuild smoke test (dist/)\n');
check('ESM  dist/index.js', await import(resolve(dist, 'index.js')));
check('CJS  dist/index.cjs', createRequire(import.meta.url)(resolve(dist, 'index.cjs')));
console.log('\n✓ dist is usable\n');
