// One place for the defaults and patterns. Everything else stays pure flow.

/** Default tag names / comment markers treated as shaders. */
export const DEFAULT_TAGS = ['glsl', 'wgsl', 'shader'];

/**
 * Files the plugin processes by default. Babel parses the JS/TS family, so the
 * default reaches every variant it can actually read: .js .jsx .ts .tsx and the
 * .mjs/.cjs/.mts/.cts module flavours. Non-JS containers won't parse as a
 * whole-file AST — point `include` at them with `scan: 'loose'` instead.
 */
export const DEFAULT_INCLUDE = [/\.[mc]?[jt]sx?$/];

/** Files the plugin skips by default. */
export const DEFAULT_EXCLUDE = [/node_modules/, /dist/];

/** Matches a `/* glsl *\/`-style leading comment naming one of `tags` (captures the tag). */
export const tagCommentRe = (tags) => new RegExp(`^\\s*(${tags.join('|')})\\s*$`);

/**
 * A GLSL/WGSL keyword that only shows up in real shader source, never in
 * incidental JS text. `scan: 'loose'` has no AST to confirm a `tag\`...\`` match
 * is actually a shader (unlike `scan: 'ast'`, which only ever sees real tagged
 * templates) — a regex can't tell "glsl" the tag from "glsl" a coincidental
 * identifier prefix, so this is the second check before touching a match.
 */
export const SHADER_SIGNAL = /\b(gl_FragColor|gl_Position|void\s+main|precision\s+(highp|mediump|lowp)|fn\s+main)\b/;

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
/**
 * Whitespace hugging a delimiter (`( ) { } ; ,`) — strip it (`$1`). These chars
 * can't be part of an identifier, so removing adjacent space never merges two
 * tokens. `=` is deliberately NOT here: it's GLSL-safe but would weld a WGSL
 * generic-close onto assignment (`vec2<f32> = a` → `>=`). Only ever applied to
 * statement lines — never preprocessor (`#`) / `\`-continued lines, where a space
 * before `(` is significant (`#define FOO (x)` ≠ `#define FOO(x)`).
 */
export const RE_DELIM_WS = /\s*([(){};,])\s*/g;

/** WGSL markers — a shader with any of these is WGSL, not GLSL. */
export const WGSL_SIGNAL = /@vertex|@fragment|@group|var<|@compute/;
/** True when `src` looks like WGSL (has WGSL markers and no GLSL `main`). */
export const isWGSL = (src) => WGSL_SIGNAL.test(src) && !/void\s+main/.test(src);

/**
 * Whitespace hugging a lone `=` — strip it. Only matches when whitespace sits
 * on *both* immediate sides of the `=`, which is what keeps this digraph-safe:
 * every compound operator that ends in `=` (`==` `<=` `>=` `!=` `+=` `-=` `*=`
 * `/=` `%=` `&=` `|=` `^=`) has zero space between its own characters in valid
 * source, so the char adjacent to `=` is never whitespace there — this pattern
 * simply never matches inside one. GLSL-only: WGSL pairs this with `<f32>`
 * generics, where trimming `vec2<f32> = a` welds the generic-close `>` onto
 * `=` into the `>=` token (see RE_DELIM_WS) — gate this on `!isWGSL(src)`.
 * The `(?<!>)` lookbehind is a second, syntax-level guard against that exact
 * case: `isWGSL` is a heuristic (keyword sniffing) and can miss a WGSL
 * fragment that has no `@vertex`/`@group`/`var<`/etc marker in view, so the
 * pattern itself never touches a `=` directly after a `>` either way.
 */
export const RE_EQ_WS = /(?<!>)\s+=\s+/g;
