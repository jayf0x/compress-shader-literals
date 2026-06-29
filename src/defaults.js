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
