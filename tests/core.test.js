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

test('minifyShader normalizes CRLF and joins statements onto one line', () => {
  const out = minifyShader('void main() {}\r\n\r\nvoid foo() {}');
  expect(out).not.toContain('\r');
  expect(out).toBe('void main(){}void foo(){}');
});

test('minifyShader strips whitespace around delimiters but not operators', () => {
  const out = minifyShader('void main ( ) { float x = a + b ; }');
  // ( ) { } ; tighten; the `=` and `+` operators keep their spaces.
  expect(out).toBe('void main(){float x = a + b;}');
});

test('minifyShader leaves WGSL generics intact (no >= welding)', () => {
  // `=` is never trimmed, so the generic-close `>` can't fuse onto assignment.
  expect(minifyShader('var x: vec2<f32> = a;')).toBe('var x: vec2<f32> = a;');
});

test('minifyShader keeps newlines around # preprocessor directives', () => {
  const out = minifyShader('precision highp float;\n#define K 2\nint b = K;');
  expect(out).toBe('precision highp float;\n#define K 2\nint b = K;');
});

test('minifyShader preserves \\ line-continuations (multiline #define)', () => {
  const out = minifyShader('#define SUM(a,b) \\\n  ((a) + \\\n   (b))\nvoid main(){}');
  // Every backslash must stay immediately before a newline, or the macro breaks.
  expect(out).not.toMatch(/\\(?!\n)/);
  expect(out).toBe('#define SUM(a,b) \\\n((a) + \\\n(b))\nvoid main(){}');
});
