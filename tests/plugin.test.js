import { parse } from '@babel/parser';
import { expect, test } from 'bun:test';

import { compressShaderLiterals } from '../src/index.js';

const plugin = compressShaderLiterals.raw({});

const withShader = `
const frag = /* glsl */ \`
  // tonemap
  precision highp float;
  void main() {
    /* output */
    gl_FragColor = vec4(1.0);
  }
\`;
`;

// "With" the plugin: the literal shrinks, comments go, and — the part that
// matters — the surrounding module is still valid JS we can re-parse.
test('plugin minifies in place and leaves valid JS (with)', () => {
  const out = plugin.transform(withShader, 'shader.js');
  expect(out).not.toBeNull();
  expect(out.code.length).toBeLessThan(withShader.length);
  expect(out.code).not.toContain('// tonemap');
  expect(out.code).not.toContain('/* output */');
  expect(() => parse(out.code, { sourceType: 'module' })).not.toThrow();
});

// "Without" a shader tag: a plain template literal must come back untouched.
test('plugin is a no-op without a shader tag (without)', () => {
  const code = 'const msg = `just a string with // not a comment`;';
  expect(plugin.transform(code, 'plain.js')).toBeNull();
});

// New default include reaches the JS/TS family, not just .js/.ts.
test('default include covers .mjs/.cjs/.mts, skips non-JS containers', () => {
  for (const id of ['a.mjs', 'a.cjs', 'a.mts', 'a.tsx']) {
    expect(plugin.transform(withShader, id)).not.toBeNull();
  }
  for (const id of ['a.css', 'a.glsl', 'a.vue']) {
    expect(plugin.transform(withShader, id)).toBeNull();
  }
});

// scan: 'loose' reaches a file Babel can't parse as a whole (a Svelte-style
// <script> block mixed with markup) — the AST path returns nothing here.
test('scan: "loose" minifies shaders in non-JS-parseable source', () => {
  const svelteLike =
    '<script>\nconst frag = glsl`\n  // tonemap\n  void main() { gl_FragColor = vec4(1.0); }\n`;\n</script>\n<div/>';

  const astPlugin = compressShaderLiterals.raw({ include: [/\.svelte$/] });
  expect(astPlugin.transform(svelteLike, 'App.svelte')).toBeNull();

  const loosePlugin = compressShaderLiterals.raw({ scan: 'loose', include: [/\.svelte$/] });
  const out = loosePlugin.transform(svelteLike, 'App.svelte');
  expect(out).not.toBeNull();
  expect(out.code).not.toContain('// tonemap');
  expect(out.code).toContain('glsl`void main(){gl_FragColor=vec4(1.0);}`');
});

// validate: true dynamically imports validate.js (see src/plugin.js) — a real
// shader (no `transform` override) never fails to re-parse, so this is the
// "silent" path: transform resolves to the same result as without validate.
test('validate: true resolves (async) and leaves valid output untouched', async () => {
  const validatingPlugin = compressShaderLiterals.raw({ validate: true });
  const out = validatingPlugin.transform(withShader, 'shader.js');
  expect(typeof out.then).toBe('function'); // validate makes transform return a Promise
  const resolved = await out;
  expect(resolved.code).not.toContain('// tonemap');
});

// A custom `transform` that corrupts the shader (drops a brace) must surface a
// build warning via the standard rollup/unplugin `this.warn` — the plugin
// context method, not console.warn — so bundlers show it like any other
// plugin warning.
test('validate: true warns when a custom transform breaks the shader', async () => {
  const warnings = [];
  const ctx = { warn: (msg) => warnings.push(msg) };

  const breakingPlugin = compressShaderLiterals.raw({
    validate: true,
    transform: (src) => src.replace('}', ''),
  });

  const out = breakingPlugin.transform.call(ctx, withShader, 'shader.js');
  await out;
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain('stopped parsing');
});

// transformBatch gets every literal in the module in one call and must return
// results in the same order — this is the hook a "spawn once, minify N
// shaders" engine (e.g. shader_minifier) plugs into instead of `transform`.
test('transformBatch receives all literals at once and applies results in order', async () => {
  const twoShaders = `
const a = /* glsl */ \`AAA\`;
const b = /* glsl */ \`BBB\`;
`;
  const seen = [];
  const batchPlugin = compressShaderLiterals.raw({
    transformBatch: (sources) => {
      seen.push(sources);
      return sources.map((s) => s.toLowerCase());
    },
  });

  const out = await batchPlugin.transform(twoShaders, 'shader.js');
  expect(seen).toEqual([['AAA', 'BBB']]);
  expect(out.code).toContain('`aaa`');
  expect(out.code).toContain('`bbb`');
});

// transformBatch wins over transform when both are set.
test('transformBatch takes priority over transform', async () => {
  const batchPlugin = compressShaderLiterals.raw({
    transform: () => 'wrong',
    transformBatch: (sources) => sources.map((s) => s.toUpperCase()),
  });

  const out = await batchPlugin.transform('const a = /* glsl */ `abc`;', 'shader.js');
  expect(out.code).toContain('`ABC`');
});
