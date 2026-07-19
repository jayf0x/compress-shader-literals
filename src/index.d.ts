import type { UnpluginInstance } from 'unplugin';

/** A picomatch glob string, RegExp, or a list of them — matched against module ids. */
type FilterPattern = string | RegExp | ReadonlyArray<string | RegExp> | null;

export interface CompressShaderLiteralsOptions {
  /** Tag names / comment markers to match. Default: `['glsl', 'wgsl', 'shader']` */
  tags?: string[];
  /**
   * Extraction method. `'ast'` parses the whole file with Babel (JS/TS only).
   * `'loose'` finds the same tagged/comment-prefixed literal shapes by regex
   * instead, for files Babel can't parse — point `include` at them yourself.
   * No whole-file parse means no syntax guarantee; only a match confirmed by a
   * shader-content check is touched. Default: `'ast'`
   */
  scan?: 'ast' | 'loose';
  /** Files to process. Default: `[/\.[mc]?[jt]sx?$/]` (the JS/TS family Babel can parse). */
  include?: FilterPattern;
  /** Files to skip. Default: `[/node_modules/, /dist/]` */
  exclude?: FilterPattern;
  /** Print a bytes-saved summary after build. Default: `false` */
  outputRatio?: boolean;
  /** Custom minifier, replaces the built-in `minifyShader`. Receives the raw literal, returns the transformed source. */
  transform?: (shader: string) => string;
  /**
   * Batch minifier for engines that minify many shaders in one call (e.g. one
   * binary spawn, consistent identifier renaming across shaders). Called once
   * per module with every literal's raw source; must return the same number
   * of results in the same order. Takes priority over `transform` when set.
   */
  transformBatch?: (shaders: string[]) => string[] | Promise<string[]>;
  /** Log each file's discovered literals to the console. Default: `false` */
  debug?: boolean;
  /**
   * Re-parse each changed shader before/after minifying and warn on build if
   * one stops parsing. Needs `@shaderfrog/glsl-parser` (GLSL) and/or
   * `wgsl_reflect` (WGSL) installed — both are optional peer dependencies,
   * loaded lazily so non-validating builds never pay for them. Default: `false`
   */
  validate?: boolean;
}

/** A shader literal discovered in source. */
export interface ShaderLiteral {
  tag: string;
  value: string;
  start: number;
  end: number;
}

/**
 * Minify GLSL/WGSL shader template literals at build time.
 *
 * Universal plugin — call the bundler you use: `.vite()`, `.rollup()`,
 * `.webpack()`, `.esbuild()`, `.rspack()`, `.rolldown()`, `.farm()`.
 */
export declare const compressShaderLiterals: UnpluginInstance<CompressShaderLiteralsOptions | undefined, boolean>;

/** Find tagged (`glsl\`...\``) and comment-prefixed (`/* wgsl *\/ \`...\``) shader literals in source. */
export declare function extractShaderLiterals(code: string, tags?: string[]): ShaderLiteral[];

/** Same as `extractShaderLiterals`, but by regex instead of a Babel parse — for source Babel can't parse. */
export declare function extractShaderLiteralsLoose(code: string, tags?: string[]): ShaderLiteral[];

/** Strip comments and collapse whitespace in a shader source string. */
export declare function minifyShader(src: string): string;
