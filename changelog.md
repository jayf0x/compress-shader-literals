# Changelog

## v0.0.5

Baseline. Universal unplugin (Vite, Rollup, webpack, esbuild, Rspack, Rolldown, Farm) that minifies GLSL/WGSL shader template literals at build time:

- Strips comments and collapses whitespace via `magic-string` (sourcemaps preserved)
- Matches tagged (`` glsl`...` ``) and comment-prefixed (`` /* wgsl */ `...` ``) literals
- Configurable `tags`, `include`, `exclude`
- Optional `outputRatio` bytes-saved summary via `byte-snap`
