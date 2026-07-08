/**
 * Shared test utils — one home for the corpus, the shader-detection patterns,
 * validation, and byte measurement. Every test file (e2e, dump, experimental)
 * imports from here so nothing is redefined inline.
 */
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import glsl from '@shaderfrog/glsl-parser';
import { diff, snap } from 'byte-snap';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { WgslParser } from 'wgsl_reflect/wgsl_reflect.module.js';

import { minifyShader } from '../src/core.js';
import { RE_BLOCK_COMMENT, RE_CRLF, RE_LINE_COMMENT } from '../src/defaults.js';

const traverse = _traverse.default || _traverse;
const here = dirname(fileURLToPath(import.meta.url));

// --- Compression methods -----------------------------------------------------

/**
 * Every method under comparison: [name, transform]. `minifyShader` is the
 * shipped baseline; the rest are pre-release candidates measured against it
 * (see tests/experimental.js). Add a method here and it appears everywhere the
 * comparison runs — the experimental suite and the per-chunk dump.
 */
export const METHODS = [['minify (shipped)', minifyShader]];

// --- Patterns ----------------------------------------------------------------

/** A template-literal body "is a shader" if its text uses GLSL/WGSL keywords. */
export const SHADER_SIGNAL = /\b(gl_FragColor|gl_Position|void\s+main|precision\s+(highp|mediump|lowp)|fn\s+main)\b/;
/** WGSL markers — used to route WGSL to the wgsl_reflect parser instead of GLSL's. */
export const WGSL_SIGNAL = /@vertex|@fragment|@group|var<|@compute/;
/** JS module files we walk for shader literals. */
export const JS_FILE = /\.(js|mjs|cjs)$/;

/** True when `src` looks like WGSL (has WGSL markers and no GLSL `main`). */
export const isWGSL = (src) => WGSL_SIGNAL.test(src) && !/void\s+main/.test(src);

/**
 * A backslash that is not immediately followed by a newline. In GLSL a `\` is
 * only ever a line-continuation (multiline `#define`/directive), which is legal
 * *only* right before a newline; WGSL has no legal `\` at all. So this pattern
 * is a whitespace-corruption smoke alarm that works even where no parser can
 * check the shader — glslify fragments and WGSL both land in the parser's blind
 * spots, and this is what catches a joined-away continuation there.
 */
export const RE_BROKEN_CONTINUATION = /\\(?!\n)/;
/** A whitespace/comment-only transform must never break a line-continuation. */
export const continuationOk = (src) => !RE_BROKEN_CONTINUATION.test(src);

/**
 * Structural invariant that needs no parser, so it reaches the WGSL + glslify
 * fragments the GLSL parser can't (~a third of the corpus). The minifier only
 * touches whitespace and comments — it never adds or removes a bracket — so the
 * bracket/paren/brace counts of the comment-stripped source must equal those of
 * the output. Comments are stripped from `before` first (their inner brackets go
 * away legitimately); partial fragments are fine because this compares before↔
 * after, not "is balanced". Any mismatch is real corruption.
 */
export function bracketsOk(before, after) {
  const clean = before.replace(RE_CRLF, '\n').replace(RE_BLOCK_COMMENT, '').replace(RE_LINE_COMMENT, '');
  const count = (s) => {
    const c = [0, 0, 0, 0, 0, 0];
    const k = '()[]{}';
    for (const ch of s) {
      const i = k.indexOf(ch);
      if (i >= 0) c[i]++;
    }
    return c.join(',');
  };
  return count(clean) === count(after);
}

// --- Corpus ------------------------------------------------------------------

/**
 * The packages to benchmark, derived from tests/package.json `dependencies` —
 * no hardcoded list (same source of truth as validate.js). Add a benchmark by
 * `bun add`ing it in tests/; packages shipping no shader literals contribute 0.
 */
export function packages() {
  const pkgJSON = JSON.parse(readFileSync(resolve(here, 'package.json'), 'utf8'));
  return Object.keys(pkgJSON.dependencies ?? {});
}

/** Recursively list JS module files under `dir` (skips nested node_modules). */
export function jsFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) jsFiles(full, out);
    else if (JS_FILE.test(name)) out.push(full);
  }
  return out;
}

/** Every template literal in `code` whose body reads as a shader. */
export function shadersInCode(code) {
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

/** Flat corpus across all benchmarked packages: [{ pkg, file, src }] (file is package-relative). */
export function collectShaders() {
  const shaders = [];
  for (const pkg of packages()) {
    const root = resolve(here, 'node_modules', pkg);
    if (!existsSync(root)) continue;
    for (const full of jsFiles(root)) {
      const file = full.slice(root.length + 1);
      for (const src of shadersInCode(readFileSync(full, 'utf8'))) shaders.push({ pkg, file, src });
    }
  }
  if (shaders.length === 0) {
    console.error('No shaders found. Run `bun install` in tests/ first.');
    process.exit(1);
  }
  return shaders;
}

// --- Validation & measurement ------------------------------------------------

/**
 * Classify one before/after pair against a real parser for its dialect
 * (`@shaderfrog/glsl-parser` for GLSL, `wgsl_reflect` for WGSL):
 *   'ok'       — parsed before AND after (the guarantee we want)
 *   'broken'   — parsed before, not after (a real bug)
 *   'fragment' — didn't parse even before (glslify chunk or macro-laden WGSL
 *                fragment — e.g. `#ifdef`-guarded Babylon.js shaders — out of scope)
 *
 * Before delegating to either parser, catch the corruption they *can't* see with
 * parser-free invariants (broken line-continuation, changed bracket balance) —
 * these are the only checks that reach fragments too broken for any parser.
 */
export function validateGlsl(before, after) {
  if (continuationOk(before) && !continuationOk(after)) return 'broken';
  if (!bracketsOk(before, after)) return 'broken';
  const parse = isWGSL(before)
    ? (src) => new WgslParser().parse(src)
    : (src) => glsl.parser.parse(src, { quiet: true });
  try {
    parse(before);
  } catch {
    return 'fragment';
  }
  try {
    parse(after);
    return 'ok';
  } catch {
    return 'broken';
  }
}

/** Raw bytes (byte-snap) plus what actually ships after gzip and brotli. */
export function measure(before, after) {
  const raw = diff(snap.text(before), snap.text(after)).json();
  const gzBefore = gzipSync(before).length;
  const gzAfter = gzipSync(after).length;
  const brBefore = brotliCompressSync(before).length;
  const brAfter = brotliCompressSync(after).length;
  const pct = (b, a) => (b === 0 ? 0 : ((b - a) / b) * 100);
  return {
    rawBefore: raw.beforeBytes,
    rawAfter: raw.afterBytes,
    rawSavedPct: raw.savedPercent,
    gzBefore,
    gzAfter,
    gzSavedPct: pct(gzBefore, gzAfter),
    brBefore,
    brAfter,
    brSavedPct: pct(brBefore, brAfter),
  };
}
