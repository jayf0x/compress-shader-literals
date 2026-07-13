import { createFilter } from '@rollup/pluginutils';
import { diff, snap } from 'byte-snap';
import MagicString from 'magic-string';
import { createUnplugin } from 'unplugin';

import { extractShaderLiterals, extractShaderLiteralsLoose, minifyShader } from './core.js';
import { DEFAULT_EXCLUDE, DEFAULT_INCLUDE, DEFAULT_TAGS } from './defaults.js';

// validate.js is dynamically imported (see below), not statically, so its code
// — and the parser peer deps it lazily pulls in — stay out of dist/index.js
// entirely for the (majority) of builds that never set `validate: true`.
let validatePromise;

// plugin.js is the build entry (index.js tree-shakes to nothing under
// sideEffects:false), so re-export the public core API here too — keeps dist's
// runtime exports matching index.d.ts.
export { extractShaderLiterals, extractShaderLiteralsLoose, minifyShader } from './core.js';

export const compressShaderLiterals = createUnplugin((options = {}) => {
  const tags = options.tags || DEFAULT_TAGS;
  const minify = options.transform || minifyShader;
  const extract = options.scan === 'loose' ? extractShaderLiteralsLoose : extractShaderLiterals;
  const filter = createFilter(options.include || DEFAULT_INCLUDE, options.exclude || DEFAULT_EXCLUDE);

  // Accumulate the shader source before/after so byte-snap can report the diff.
  let beforeText = '';
  let afterText = '';
  let shaderCount = 0;

  return {
    name: 'compress-shader-literals',
    enforce: 'pre',

    transform(code, id) {
      if (!filter(id)) return null;
      if (!tags.some((tag) => code.includes(tag))) return null;

      const literals = extract(code, tags);
      if (literals.length === 0) return null;

      if (options.debug) {
        console.log(
          `[compress-shader-literals] ${id}: ${literals.length} literal(s) — ${literals.map((l) => l.tag).join(', ')}`
        );
      }

      const ms = new MagicString(code);
      let hasChanges = false;
      const pending = [];

      for (const literal of literals) {
        const minified = minify(literal.value);

        if (literal.value !== minified) {
          ms.overwrite(literal.start, literal.end, `\`${minified}\``);
          hasChanges = true;

          if (options.validate) {
            validatePromise ??= import('./validate.js');
            pending.push(
              validatePromise
                .then(({ validateShader }) => validateShader(literal.value, minified))
                .then((status) => {
                  if (status === 'broken') {
                    this.warn(`compress-shader-literals: minified ${literal.tag}\`...\` in ${id} stopped parsing`);
                  }
                })
            );
          }
        }

        if (options.outputRatio) {
          beforeText += literal.value;
          afterText += minified;
          shaderCount++;
        }
      }

      if (!hasChanges) return null;

      const result = {
        code: ms.toString(),
        map: ms.generateMap({ hires: true, source: id }),
      };

      return pending.length ? Promise.all(pending).then(() => result) : result;
    },

    buildEnd() {
      if (options.outputRatio && beforeText) {
        const label = `compress-shader-literals: ${shaderCount} shader literal${shaderCount === 1 ? '' : 's'}`;
        diff(snap.text(beforeText), snap.text(afterText)).print(label);
      }
    },
  };
});
