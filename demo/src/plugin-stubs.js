// The demo only ever imports extractShaderLiterals/minifyShader from
// compress-shader-literals, but its published dist is a single bundled file
// that also pulls in @rollup/pluginutils/unplugin/byte-snap/magic-string for
// the bundler-plugin half we don't use — all Node-only, so they break a
// browser build. Tree-shaking removes the *usage*, but the unused half's
// imports still get parsed before shaking runs, so alias them to a no-op
// stub instead of asking the published package to change its bundling.
export function createFilter() {
  return () => false;
}
export function createUnplugin() {
  return {};
}
export function diff() {
  return { print() {}, json: () => ({}) };
}
export const snap = { text: () => null, buffer: () => null };
export default class MagicString {
  overwrite() {}
  toString() {
    return '';
  }
  generateMap() {
    return null;
  }
}
