import { expect, test } from 'bun:test';

import { extractShaderLiterals, minifyShader } from '../src/core.js';

test('minifyShader strips comments and collapses whitespace', () => {
  const src = `
    // line comment
    precision   highp   float;
    /* block comment */
    void main() {}
  `;
  const out = minifyShader(src);
  expect(out).not.toContain('//');
  expect(out).not.toContain('/*');
  expect(out).not.toMatch(/ {2,}/);
  expect(out).toContain('precision highp float;');
});

test('minifyShader is idempotent', () => {
  const once = minifyShader('void  main( ) {}');
  expect(minifyShader(once)).toBe(once);
});

test('extractShaderLiterals finds tagged template literals', () => {
  const code = 'const v = glsl`void main() {}`;';
  const lits = extractShaderLiterals(code, ['glsl']);
  expect(lits).toHaveLength(1);
  expect(lits[0].tag).toBe('glsl');
  expect(lits[0].value).toContain('void main()');
});

test('extractShaderLiterals finds comment-prefixed literals', () => {
  const code = 'const v = /* wgsl */ `fn main() {}`;';
  const lits = extractShaderLiterals(code);
  expect(lits).toHaveLength(1);
  expect(lits[0].tag).toBe('wgsl');
});

test('extractShaderLiterals honors custom tags in comment form', () => {
  const code = 'const v = /* myshader */ `void main() {}`;';
  const lits = extractShaderLiterals(code, ['myshader']);
  expect(lits).toHaveLength(1);
  expect(lits[0].tag).toBe('myshader');
});

test('extractShaderLiterals ignores untagged literals', () => {
  const code = 'const v = `just a string`;';
  expect(extractShaderLiterals(code)).toHaveLength(0);
});

test('extractShaderLiterals skips interpolated tagged templates', () => {
  const code = 'const v = glsl`vec3 c = ${myColor}; void main() {}`;';
  expect(extractShaderLiterals(code, ['glsl'])).toHaveLength(0);
});

test('extractShaderLiterals skips interpolated comment-prefixed templates', () => {
  const code = 'const v = /* glsl */ `vec3 c = ${myColor}; void main() {}`;';
  expect(extractShaderLiterals(code)).toHaveLength(0);
});

test('minifyShader normalizes CRLF line endings', () => {
  const out = minifyShader('void main() {}\r\n\r\nvoid foo() {}');
  expect(out).not.toContain('\r');
  expect(out).toBe('void main() {}\nvoid foo() {}');
});
