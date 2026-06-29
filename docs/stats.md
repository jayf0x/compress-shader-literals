# How the stats are measured

The numbers in the README come from [`tests/e2e.js`](../tests/e2e.js), run against the real published packages.

## What's measured

- Walk each library's installed files and find every template literal whose contents look like a shader (matches `gl_FragColor`, `gl_Position`, `void main`, `precision …`, `fn main`).
- Run the built-in `minifyShader` over each one and sum the bytes before and after.

## This is an engine benchmark, not default plugin output

These libraries don't tag their shaders, so the benchmark detects them by content. The plugin matches by **tag** (`` glsl`…` `` or `/* glsl */`) and skips `node_modules` by default — so out of the box it minifies **your own tagged shaders**, not a dependency's. To minify a dependency's shaders, clear `exclude` and supply a content-based `transform`.

## Validity

Every GLSL shader in the set is parsed before and after minify with [`@shaderfrog/glsl-parser`](https://github.com/shaderfrog/glsl-parser). The run fails if minify breaks a shader that was valid before.

Latest run: **312/312** parseable GLSL shaders still valid (0 broken). WGSL has no GLSL parser to check against, and glslify fragments that don't parse on their own (missing `#include` context) are skipped.

## Reproduce

```sh
cd tests && bun install
node e2e.js            # print the table
node e2e.js --write    # update the README table
```
