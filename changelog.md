# Changelog

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
