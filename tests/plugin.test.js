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
