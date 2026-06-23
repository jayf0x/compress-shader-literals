import { createFilter } from '@rollup/pluginutils';
import MagicString from 'magic-string';
import { createUnplugin } from 'unplugin';

import { extractShaderLiterals, minifyShader } from './core.js';

// ponytail: inline stats mirror byte-snap's output. Swap for the `byte-snap`
// package once it's published; until then a sibling/gitignored import can't
// survive the publish boundary or CI.
function fmtBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toFixed(2)} ${units[u]}`;
}

function printRatio(beforeBytes, afterBytes, files) {
  const saved = beforeBytes - afterBytes;
  const pct = beforeBytes === 0 ? 0 : (saved / beforeBytes) * 100;
  console.log('\ncompress-shader-literals');
  console.log('────────────────────────');
  console.log(`${fmtBytes(beforeBytes)} → ${fmtBytes(afterBytes)}`);
  console.log(`saved: ${fmtBytes(saved)} (${pct.toFixed(2)}% smaller)`);
  console.log(`shaders: ${files}\n`);
}

export const compressShaderLiterals = createUnplugin((options = {}) => {
  const tags = options.tags || ['glsl', 'wgsl', 'shader'];
  const filter = createFilter(options.include || [/\.[jt]sx?$/], options.exclude || [/node_modules/, /dist/]);

  const stats = { before: 0, after: 0, files: 0 };

  return {
    name: 'compress-shader-literals',
    enforce: 'pre',

    transform(code, id) {
      if (!filter(id)) return null;
      if (!tags.some((tag) => code.includes(tag))) return null;

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
        stats.before += Buffer.byteLength(code);
        stats.after += Buffer.byteLength(resultCode);
        stats.files += 1;
      }

      return {
        code: resultCode,
        map: ms.generateMap({ hires: true, source: id }),
      };
    },

    buildEnd() {
      if (options.outputRatio && stats.files > 0) {
        printRatio(stats.before, stats.after, stats.files);
      }
    },
  };
});
