import { createFilter } from '@rollup/pluginutils';
import MagicString from 'magic-string';
import { createUnplugin } from 'unplugin';

import { diff, snap } from '../byte-snap/index.js';
import { extractShaderLiterals, minifyShader } from './core.js';

export const compressShaderLiterals = createUnplugin((options = {}) => {
  const tags = options.tags || ['glsl', 'wgsl', 'shader'];
  const filter = createFilter(options.include || [/\.[jt]sx?$/], options.exclude || [/node_modules/, /dist/]);

  const snaps = [];

  return {
    name: 'compress-shader-literals',
    enforce: 'pre',

    transform(code, id) {
      if (!filter(id)) return null;
      if (!tags.some((tag) => code.includes(tag))) return null;

      const before = snap.text(code);
      const literals = extractShaderLiterals(code, tags);
      if (literals.length === 0) return null;

      const ms = new MagicString(code);
      let hasChanges = false;

      for (const literal of literals) {
        const minified = minifyShader(literal.value);

        if (literal.value !== minified) {
          ms.overwrite(literal.start, literal.end, `\`${minified}\``);
          hasChanges = true;
        }
      }

      if (!hasChanges) return null;

      const resultCode = ms.toString();

      if (options.outputRatio) {
        snaps.push({ id, before, after: snap.text(resultCode) });
      }

      return {
        code: resultCode,
        map: ms.generateMap({ hires: true, source: id }),
      };
    },

    buildEnd() {
      if (options.outputRatio && snaps.length > 0) {
        const before = {
          timestamp: 0,
          files: snaps.length,
          bytes: { total: snaps.reduce((s, e) => s + e.before.bytes.total, 0), average: 0, largest: 0, smallest: 0 },
          entries: [],
        };
        const after = {
          timestamp: 0,
          files: snaps.length,
          bytes: { total: snaps.reduce((s, e) => s + e.after.bytes.total, 0), average: 0, largest: 0, smallest: 0 },
          entries: [],
        };
        diff(before, after).print();
      }
    },
  };
});
