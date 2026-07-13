import { bracketsOk, continuationOk, isWGSL } from './defaults.js';

function missingPeer(name) {
  console.warn(
    `compress-shader-literals: validate:true needs "${name}" installed (it's an optional peer dependency) — skipping validation for that dialect.`
  );
}

// Real parsers are optional peer deps (see package.json) — most consumers
// never opt into `validate: true`, so they shouldn't have to install either
// one. validate.js is itself only ever loaded when validate:true is set (see
// plugin.js's dynamic import), so firing both imports here at module init
// doesn't cost non-validating builds anything. Each parser is wrapped in a
// closure (not just a bare method reference) because both `glsl.parser.parse`
// and `WgslParser#parse` read internal state off `this` — a detached
// reference throws the moment it's called. WGSL also gets a fresh instance
// per parse: `_context` isn't reset inside `parse()`, so reusing one instance
// across unrelated shaders would leak declared symbols between them.
let glslParser;
let wgslParser;

const glslReady = import('@shaderfrog/glsl-parser')
  .then((m) => {
    glslParser = (src) => m.default.parser.parse(src, { quiet: true });
  })
  .catch(() => missingPeer('@shaderfrog/glsl-parser'));

// The bare "wgsl_reflect" specifier resolves to its `main` field, which is
// CJS despite the package declaring `"type": "module"` — plain Node chokes on
// it (empty module, no thrown error), even though some runtimes paper over
// it. Import the real ESM entry point directly, matching tests/utils.js.
const wgslReady = import('wgsl_reflect/wgsl_reflect.module.js')
  .then((m) => {
    wgslParser = (src) => new m.WgslParser().parse(src);
  })
  .catch(() => missingPeer('wgsl_reflect'));

/**
 * Classify one before/after shader pair for the opt-in `validate: true` build
 * check — same three-way verdict as the benchmark corpus's validateGlsl
 * (tests/utils.js), reusing its parser-free invariants:
 *   'ok'       — parsed before AND after (the guarantee we want)
 *   'broken'   — parsed before, not after (a real bug — worth a build warning)
 *   'fragment' — didn't parse even before (glslify chunk / macro-laden WGSL —
 *                out of scope for any parser, not a fault of the minifier)
 */
export async function validateShader(before, after) {
  if (continuationOk(before) && !continuationOk(after)) return 'broken';
  if (!bracketsOk(before, after)) return 'broken';

  const wgsl = isWGSL(before);
  await (wgsl ? wgslReady : glslReady);

  const parse = wgsl ? wgslParser : glslParser;
  if (!parse) throw new Error('compress-shader-literals: validate:true needs its parser peer dependency installed');

  try {
    parse(before);
  } catch {
    return 'fragment';
  }
  try {
    parse(after);
    return 'ok';
  } catch {
    return 'broken';
  }
}
