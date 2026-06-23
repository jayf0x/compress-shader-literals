import { compressShaderLiterals } from './index.js';

// Self-contained demo: run with `node src/run-test.js`
const code = `
const vert = /* glsl */ \`
  // vertex shader
  precision   highp   float;

  attribute vec3 position;   // model space

  void main() {
    /* project to clip space */
    gl_Position = vec4(position, 1.0);
  }
\`;
`;

const plugin = compressShaderLiterals.raw({ outputRatio: true });

console.log('--- compress-shader-literals ---');
console.log('input size:', Buffer.byteLength(code), 'bytes');

const result = plugin.transform(code, 'demo.js');

if (result) {
  console.log('output size:', Buffer.byteLength(result.code), 'bytes');
  plugin.buildEnd();
} else {
  console.log('no changes (nothing to compress)');
}
