/**
 * Candidate: "compress as much as possible, where it's still useful."
 *
 * Whitespace/comment-only — no identifier renaming, no operator-space removal.
 * That line is deliberate: renaming + dead-code elimination is what heavyweight
 * shader minifiers (laurentlb/shader-minifier) do, and it risks breaking real
 * shaders. We stay the light-weight, compatible layer.
 *
 * On top of the current minifyShader this adds: trim each line, drop the blank
 * lines that survive today (they're ' \n', not '\n\n'), and join statements onto
 * one line — keeping real newlines ONLY around `#` preprocessor directives,
 * which are newline-sensitive in GLSL.
 *
 * Exported for tests/experimental/index.js to measure + validate.
 */
import { RE_BLOCK_COMMENT, RE_CRLF, RE_INLINE_WS, RE_LINE_COMMENT } from '../../src/defaults.js';

export const name = 'aggressive-whitespace';

export const transform = (src) => {
  const lines = src
    .replace(RE_CRLF, '\n')
    .replace(RE_BLOCK_COMMENT, '')
    .replace(RE_LINE_COMMENT, '')
    .split('\n')
    .map((l) => l.replace(RE_INLINE_WS, ' ').trim())
    .filter(Boolean);

  let out = '';
  for (const line of lines) {
    if (line.startsWith('#')) {
      // preprocessor directive: own line, newline before and after
      out += (out && !out.endsWith('\n') ? '\n' : '') + line + '\n';
    } else {
      // statement: join with a single space (token separator) unless we just
      // closed a directive line
      out += out === '' || out.endsWith('\n') ? line : ' ' + line;
    }
  }
  return out.trim();
};
