import { createFilter } from '@rollup/pluginutils';
import { diff, snap } from 'byte-snap';
import MagicString from 'magic-string';
import { createUnplugin } from 'unplugin';

import { extractShaderLiterals, minifyShader } from './core.js';
import { DEFAULT_EXCLUDE, DEFAULT_INCLUDE, DEFAULT_TAGS } from './defaults.js';

// plugin.js is the build entry (index.js tree-shakes to nothing under
// sideEffects:false), so re-export the public core API here too — keeps dist's
// runtime exports matching index.d.ts.
export { extractShaderLiterals, minifyShader } from './core.js';

export const compressShaderLiterals = createUnplugin((options = {}) => {
  const tags = options.tags || DEFAULT_TAGS;
  const minify = options.transform || minifyShader;
  const filter = createFilter(options.include || DEFAULT_INCLUDE, options.exclude || DEFAULT_EXCLUDE);

  // Accumulate the shader source before/after so byte-snap can report the diff.
  let beforeText = '';
  let afterText = '';

  return {
    name: 'compress-shader-literals',
    enforce: 'pre',

    transform(code, id) {
      if (!filter(id)) return null;
      if (!tags.some((tag) => code.includes(tag))) return null;

      const literals = extractShaderLiterals(code, tags);
      if (literals.length === 0) return null;

      if (options.debug) {
        console.log(
          `[compress-shader-literals] ${id}: ${literals.length} literal(s) — ${literals.map((l) => l.tag).join(', ')}`
        );
      }

      const ms = new MagicString(code);
      let hasChanges = false;

      for (const literal of literals) {
        const minified = minify(literal.value);

        if (literal.value !== minified) {
          ms.overwrite(literal.start, literal.end, `\`${minified}\``);
          hasChanges = true;
        }

        if (options.outputRatio) {
          beforeText += literal.value;
          afterText += minified;
        }
      }

      if (!hasChanges) return null;

      return {
        code: ms.toString(),
        map: ms.generateMap({ hires: true, source: id }),
      };
    },

    buildEnd() {
      if (options.outputRatio && beforeText) {
        diff(snap.text(beforeText), snap.text(afterText)).print();
      }
    },
  };
});
