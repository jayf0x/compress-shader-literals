/**
 * Shared utils for the experimental (pre-release) test suite.
 *
 * Three jobs, reused by every candidate:
 *   collectShaders() — the real-world shader corpus (from benchmarked packages)
 *   measure(before, after) — byte-snap raw diff + gzip/brotli, one object
 *   validateGlsl(before, after) — did the shader still parse after transform?
 */
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import glsl from '@shaderfrog/glsl-parser';
import { diff, snap } from 'byte-snap';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const traverse = _traverse.default || _traverse;
const here = dirname(fileURLToPath(import.meta.url));
const testsDir = resolve(here, '..');

// Same corpus the e2e stats use — keep in sync with tests/e2e.js PACKAGES.
const PACKAGES = ['three', '@jayf0x/fluidity-js', 'ogl', 'shader-park-core', 'curtainsjs'];
const SHADER_SIGNAL = /\b(gl_FragColor|gl_Position|void\s+main|precision\s+(highp|mediump|lowp)|fn\s+main)\b/;
const isWGSL = (src) => /@vertex|@fragment|@group|var<|@compute/.test(src) && !/void\s+main/.test(src);

function jsFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) jsFiles(full, out);
    else if (/\.(js|mjs|cjs)$/.test(name)) out.push(full);
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

/** Every shader literal in the benchmarked packages: [{ pkg, src }]. */
export function collectShaders() {
  const shaders = [];
  for (const pkg of PACKAGES) {
    const root = resolve(testsDir, 'node_modules', pkg);
    if (!existsSync(root)) continue;
    for (const file of jsFiles(root)) {
      for (const src of shadersInCode(readFileSync(file, 'utf8'))) shaders.push({ pkg, src });
    }
  }
  if (shaders.length === 0) {
    console.error('No shaders found. Run `bun install` in tests/ first.');
    process.exit(1);
  }
  return shaders;
}

/** Raw bytes via byte-snap, plus what actually ships after gzip/brotli. */
export function measure(before, after) {
  const raw = diff(snap.text(before), snap.text(after)).json();
  const gzBefore = gzipSync(before).length;
  const gzAfter = gzipSync(after).length;
  const brBefore = brotliCompressSync(before).length;
  const brAfter = brotliCompressSync(after).length;
  return {
    rawBefore: raw.beforeBytes,
    rawAfter: raw.afterBytes,
    rawSavedPct: raw.savedPercent,
    gzBefore,
    gzAfter,
    gzSavedPct: gzBefore === 0 ? 0 : ((gzBefore - gzAfter) / gzBefore) * 100,
    brBefore,
    brAfter,
    brSavedPct: brBefore === 0 ? 0 : ((brBefore - brAfter) / brBefore) * 100,
  };
}

/**
 * Classify one before/after pair against the GLSL parser.
 * Returns 'ok' | 'broken' | 'wgsl' | 'fragment' (fragment = didn't parse even
 * before, so out of scope — same rule as tests/e2e.js).
 */
export function validateGlsl(before, after) {
  if (isWGSL(before)) return 'wgsl';
  try {
    glsl.parser.parse(before, { quiet: true });
  } catch {
    return 'fragment';
  }
  try {
    glsl.parser.parse(after, { quiet: true });
    return 'ok';
  } catch {
    return 'broken';
  }
}
