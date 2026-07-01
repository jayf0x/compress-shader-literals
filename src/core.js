import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

import {
  DEFAULT_TAGS,
  RE_BLOCK_COMMENT,
  RE_CRLF,
  RE_INLINE_WS,
  RE_LINE_COMMENT,
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

// Whitespace/comment-only minify: strip comments, collapse inline whitespace,
// drop blank lines, then join statements onto one line. GLSL only needs real
// newlines around `#` preprocessor directives and `\` line-continuations
// (newline-sensitive); everything else is `;`-terminated, so joining is safe.
// No identifier renaming / operator-space removal — that's heavyweight-minifier
// territory that risks breaking shaders; we stay the light, compatible layer.
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
  return out.trim();
};
