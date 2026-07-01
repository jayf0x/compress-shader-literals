// One place for the defaults and patterns. Everything else stays pure flow.

/** Default tag names / comment markers treated as shaders. */
export const DEFAULT_TAGS = ['glsl', 'wgsl', 'shader'];

/**
 * Files the plugin processes by default. Babel parses the JS/TS family, so the
 * default reaches every variant it can actually read: .js .jsx .ts .tsx and the
 * .mjs/.cjs/.mts/.cts module flavours. Non-JS containers (.vue/.svelte/.glsl)
 * won't parse as a whole-file AST — point `include` at them only with a custom
 * `transform` that extracts the script/shader first.
 */
export const DEFAULT_INCLUDE = [/\.[mc]?[jt]sx?$/];

/** Files the plugin skips by default. */
export const DEFAULT_EXCLUDE = [/node_modules/, /dist/];

/** Matches a `/* glsl *\/`-style leading comment naming one of `tags` (captures the tag). */
export const tagCommentRe = (tags) => new RegExp(`^\\s*(${tags.join('|')})\\s*$`);

// --- Minify patterns ---------------------------------------------------------
// Named once so `minifyShader` reads as intent and any future compression flow
// (see tests/experimental) reuses the exact same rules. All global → safe with
// `.replace` (never `.test`, which would carry `lastIndex` between calls).

/** Windows line endings → `\n`, so later passes only reason about `\n`. */
export const RE_CRLF = /\r\n/g;
/** A `/* ... *\/` block comment (non-greedy, spans lines). */
export const RE_BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
/** A `// ...` line comment through end of its line. */
export const RE_LINE_COMMENT = /\/\/.*$/gm;
/** A run of spaces/tabs (collapse to one space — never touches newlines). */
export const RE_INLINE_WS = /[ \t]+/g;
/** Two or more consecutive newlines (collapse blank lines to one). */
export const RE_BLANK_LINES = /\n{2,}/g;
