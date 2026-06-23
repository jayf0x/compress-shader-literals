import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;

export function extractShaderLiterals(code, tags = ['glsl', 'wgsl', 'shader']) {
  const tagSet = new Set(tags);
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

        if (tagName) {
          literals.push({
            tag: tagName,
            value: quasi.quasis.map((q) => q.value.raw).join(''),
            start: quasi.start,
            end: quasi.end,
          });
        }
      },

      // Handle comment-prefixed templates: /* wgsl */ `...`
      TemplateLiteral(path) {
        const node = path.node;
        const leadingComments = node.leadingComments || path.parentPath?.node?.leadingComments || [] || [];
        for (const comment of leadingComments) {
          if (!comment || comment.type !== 'CommentBlock') continue;
          const m = comment.value.match(/^\s*(glsl|wgsl|shader)\s*$/);
          if (m) {
            literals.push({
              tag: m[1],
              value: node.quasis.map((q) => q.value.raw).join(''),
              start: node.start,
              end: node.end,
            });
            break;
          }
        }
      },
    });
  } catch (e) {
    // Best-effort: Ignore parsing errors for non-standard or malformed baseline files
  }

  return literals;
}

export function minifyShader(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}
