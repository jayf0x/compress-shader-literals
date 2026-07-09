# Changelog

## v1.3.5

- Internal/infrastructure changes only

## v1.3.3

- Parallelize package scanning with worker threads

## v1.3.2

- Validate WGSL shaders with a real parser

## v1.3.1

- Internal/infrastructure changes only

## v1.3.0

- Improve whitespace handling around delimiters

## v1.2.0

- Add aggressive compression mode for improved minification
- Expand shader validation
- Sort stats by compression rate

## v1.1.3

- Strengthen default plugin behavior
- Expand test coverage

## v1.0.1

- Fix handling of interpolated tagged templates
- Improve issues and compatibility
- Update byte-snap

## v1.0.0

- Integrate Vite and byte-snap for optimized bundling

## v0.0.10

- Upgrade byte-snap

## v0.0.9

- Normalize repository URL format and casing

## v0.0.8

- Internal/infrastructure changes only

## v0.0.7

- Enhance API with additional options
- Fix byte-snap handling

## v0.0.6

- Expose core API
- Add transform hook option
- Add debug flag

## v0.0.5

Baseline. Universal unplugin (Vite, Rollup, webpack, esbuild, Rspack, Rolldown, Farm) that minifies GLSL/WGSL shader template literals at build time:

- Strips comments and collapses whitespace via `magic-string` (sourcemaps preserved)
- Matches tagged (`` glsl`...` ``) and comment-prefixed (`` /* wgsl */ `...` ``) literals
- Configurable `tags`, `include`, `exclude`
- Optional `outputRatio` bytes-saved summary via `byte-snap`
