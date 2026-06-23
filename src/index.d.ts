import type { UnpluginInstance } from 'unplugin';

/** A picomatch glob string, RegExp, or a list of them — matched against module ids. */
type FilterPattern = string | RegExp | ReadonlyArray<string | RegExp> | null;

export interface CompressShaderLiteralsOptions {
  /** Tag names / comment markers to match. Default: `['glsl', 'wgsl', 'shader']` */
  tags?: string[];
  /** Files to process. Default: `[/\.[jt]sx?$/]` */
  include?: FilterPattern;
  /** Files to skip. Default: `[/node_modules/, /dist/]` */
  exclude?: FilterPattern;
  /** Print a bytes-saved summary after build. Default: `false` */
  outputRatio?: boolean;
}

/**
 * Minify GLSL/WGSL shader template literals at build time.
 *
 * Universal plugin — call the bundler you use: `.vite()`, `.rollup()`,
 * `.webpack()`, `.esbuild()`, `.rspack()`, `.rolldown()`, `.farm()`.
 */
export declare const compressShaderLiterals: UnpluginInstance<CompressShaderLiteralsOptions | undefined, boolean>;
