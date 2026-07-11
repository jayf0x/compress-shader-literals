import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

import {
  DEFAULT_TAGS,
  RE_BLOCK_COMMENT,
  RE_CRLF,
  RE_DELIM_WS,
  RE_EQ_WS,
  RE_INLINE_WS,
  RE_LINE_COMMENT,
  SHADER_SIGNAL,
  isWGSL,
  tagCommentRe,
} from './defaults.js';

const traverse = _traverse.default || _traverse;

export const extractShaderLiterals = (code, tags = DEFAULT_TAGS) => {
  const tagSet = new Set(tags);
  const commentRe = tagCommentRe(tags);
  const literals = [];

  try {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy'],
      allowReturnOutsideFunction: true,
    });

    traverse(ast, {
      // Handle explicit tagged templates: `wgsl` `...`
      TaggedTemplateExpression(path) {
        const { tag, quasi } = path.node;
        let tagName = null;

        if (tag.type === 'Identifier' && tagSet.has(tag.name)) {
          tagName = tag.name;
        } else if (
          tag.type === 'MemberExpression' &&
          tag.property.type === 'Identifier' &&
          tagSet.has(tag.property.name)
        ) {
          tagName = tag.property.name;
        }

        if (tagName && quasi.expressions.length === 0) {
          literals.push({
            tag: tagName,
            value: quasi.quasis[0].value.raw,
            start: quasi.start,
            end: quasi.end,
          });
        }
      },

      // Handle comment-prefixed templates: /* wgsl */ `...`
      TemplateLiteral(path) {
        const node = path.node;
        if (node.expressions.length > 0) return;
        const leadingComments = node.leadingComments || path.parentPath?.node?.leadingComments || [];
        for (const comment of leadingComments) {
          if (!comment || comment.type !== 'CommentBlock') continue;
          const m = comment.value.match(commentRe);
          if (m) {
            literals.push({
              tag: m[1],
              value: node.quasis[0].value.raw,
              start: node.start,
              end: node.end,
            });
            break;
          }
        }
      },
    });
  } catch (err) {
    // Source we don't parse (exotic syntax, partial files) has no literals to
    // extract — skip it. A non-syntax failure is our bug, so let it surface.
    if (err.name !== 'SyntaxError') throw err;
  }

  return literals;
};

// Finds the same two literal shapes as extractShaderLiterals (tagged and
// comment-prefixed templates) by regex instead of a whole-file Babel parse —
// for files Babel can't parse at all (anything that isn't plain JS/TS). No AST
// means no guarantee a match is really a tagged template and not, say, a
// coincidental "glsl`" inside a string; SHADER_SIGNAL is the one check this
// mode has to confirm a candidate before touching it. Opt in via `scan: 'loose'`.
const closingBacktick = (code, from) => {
  for (let i = from; i < code.length; i++) {
    if (code[i] === '\\') i++;
    else if (code[i] === '`') return i;
  }
  return -1;
};

export const extractShaderLiteralsLoose = (code, tags = DEFAULT_TAGS) => {
  const tagAlt = tags.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const openRe = new RegExp(`\\b(${tagAlt})\\s*\`|/\\*\\s*(${tagAlt})\\s*\\*/\\s*\``, 'g');
  const literals = [];

  let m;
  while ((m = openRe.exec(code))) {
    // m[0] ends in the opening backtick — literal.start/end span the whole
    // template literal (backticks included), matching extractShaderLiterals'
    // AST node positions, since plugin.js re-wraps `value` in backticks itself.
    const contentStart = m.index + m[0].length;
    const close = closingBacktick(code, contentStart);
    if (close === -1) continue;

    const value = code.slice(contentStart, close);
    if (!value.includes('${') && SHADER_SIGNAL.test(value)) {
      literals.push({ tag: m[1] ?? m[2], value, start: contentStart - 1, end: close + 1 });
    }
    openRe.lastIndex = close + 1;
  }

  return literals;
};

// Whitespace/comment-only minify: strip comments, collapse inline whitespace,
// drop blank lines, then join statements onto one line. GLSL only needs real
// newlines around `#` preprocessor directives and `\` line-continuations
// (newline-sensitive); everything else is `;`-terminated, so joining is safe.
// No identifier renaming / operator-space removal — that's heavyweight-minifier
// territory that risks breaking shaders; we stay the light, compatible layer.
//
// Deliberately regex/line-based, not a tokenizer. Tried `glsl-tokenizer` +
// `glsl-token-whitespace-trim` (the stackgl prior art) against the real corpus:
// ~1pp more raw savings, ~0 net after brotli, but it broke 8 real shaders in
// deck.gl/luma.gl — their glslify output starts with a lone `\` on its own
// line, and the token library collapses the run after it into `\ `, destroying
// the continuation this line pass preserves on purpose. Not a version gap —
// tokenizing has no concept of "this whitespace is significant". Don't swap
// this for a tokenizer without a corpus run proving it doesn't regress that.
export const minifyShader = (src) => {
  const lines = src
    .replace(RE_CRLF, '\n')
    .replace(RE_BLOCK_COMMENT, '')
    .replace(RE_LINE_COMMENT, '')
    .split('\n')
    .map((l) => l.replace(RE_INLINE_WS, ' ').trim())
    .filter(Boolean);

  let out = '';
  let cont = false; // previous line ended with a `\` continuation
  for (const line of lines) {
    if (line.startsWith('#') || cont) {
      out += (out && !out.endsWith('\n') ? '\n' : '') + line + '\n';
    } else {
      out += out === '' || out.endsWith('\n') ? line : ' ' + line;
    }
    cont = line.endsWith('\\');
  }

  // Second pass: strip whitespace hugging delimiters. Statements are now joined
  // onto single lines, so within a line `\s` is only spaces; `#`/continuation
  // lines (where a space can be significant) are left untouched.
  const wgsl = isWGSL(out);
  cont = false;
  out = out
    .split('\n')
    .map((line) => {
      if (line.startsWith('#') || cont) {
        cont = line.endsWith('\\');
        return line;
      }
      let trimmed = line.replace(RE_DELIM_WS, '$1');
      if (!wgsl) trimmed = trimmed.replace(RE_EQ_WS, '=');
      cont = line.endsWith('\\');
      return trimmed;
    })
    .join('\n');

  return out.trim();
};
