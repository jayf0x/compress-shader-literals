import { expect, test } from 'bun:test';

import { validateShader } from '../src/validate.js';

test('validateShader: ok when before and after both parse', async () => {
  const src = 'void main(){gl_FragColor=vec4(1.0);}';
  expect(await validateShader(src, src)).toBe('ok');
});

test('validateShader: broken when a bracket goes missing', async () => {
  const before = 'void main(){gl_FragColor=vec4(1.0);}';
  const after = 'void main(){gl_FragColor=vec4(1.0);';
  expect(await validateShader(before, after)).toBe('broken');
});

test('validateShader: broken when a line-continuation is joined away', async () => {
  const before = '#define SUM(a,b) \\\n((a) + (b))\nvoid main(){}';
  const after = '#define SUM(a,b) \\((a) + (b))\nvoid main(){}';
  expect(await validateShader(before, after)).toBe('broken');
});

test('validateShader: fragment when the input never parsed to begin with', async () => {
  const before = 'this is not glsl at all {{{';
  expect(await validateShader(before, before)).toBe('fragment');
});

test('validateShader: routes WGSL to the WGSL parser', async () => {
  const src = '@vertex fn main() -> @builtin(position) vec4f { return vec4f(1.0); }';
  expect(await validateShader(src, src)).toBe('ok');
});
