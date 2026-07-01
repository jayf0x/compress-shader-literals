/**
 * Experimental corruption cases — LOCAL ONLY, not wired into CI.
 *
 *   node tests/experimental-cases.js
 *
 * Hand-picked shaders that exercise the edges of the aggressive candidate
 * (statement joining + preprocessor handling). Each asserts the invariant a
 * whitespace/comment-only minifier must hold: if it parsed before, it parses
 * after — and it NEVER breaks a `\` line-continuation, even in shaders no parser
 * can check. This file goes red while `aggressiveMinify` still corrupts a case;
 * that red is the point — fix the gate first, then the logic (see backlog.md
 * "Extend shader validation").
 */
import assert from 'node:assert/strict';

import { aggressiveMinify, continuationOk, validateGlsl } from './utils.js';

// [name, source]. Add a case here the moment you find one the transform mishandles.
const CASES = [
  [
    'multiline #define (backslash continuation)',
    `#define SUM(a,b) \\
  ((a) + \\
   (b))
void main(){ gl_FragColor = vec4(SUM(1.0,2.0)); }`,
  ],
  [
    'preprocessor between statements',
    `precision highp float;
int a = 1;
#define K 2
int b = K;
void main(){ gl_FragColor = vec4(float(a+b)); }`,
  ],
  [
    '#if block wrapping statements',
    `void main(){
#if 1
  float x = 1.0;
  gl_FragColor = vec4(x);
#endif
}`,
  ],
];

let failed = 0;
for (const [name, src] of CASES) {
  const out = aggressiveMinify(src);
  try {
    assert.ok(continuationOk(out), 'broke a `\\` line-continuation');
    assert.notEqual(validateGlsl(src, out), 'broken', 'parsed before but not after');
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name} — ${err.message}`);
    console.log(`      ${JSON.stringify(out)}`);
  }
}

console.log();
if (failed) {
  console.error(`${failed}/${CASES.length} case(s) corrupted by aggressiveMinify.\n`);
  process.exit(1);
}
