import { extractShaderLiterals, minifyShader } from 'compress-shader-literals';

import { scanPackage } from './webcontainer.js';

const $ = (id) => document.getElementById(id);

const SAMPLE = `const frag = glsl\`
  // a comment, and   too   much   whitespace
  precision highp float;
  void main() {
    gl_FragColor = vec4(1.0);
  }
\`;
`;

$('input').value = SAMPLE;

// --- View 1: paste & run -----------------------------------------------

function runSimple() {
  const code = $('input').value;
  const literals = extractShaderLiterals(code);

  if (literals.length === 0) {
    $('output').value = minifyShader(code); // no tagged literal found — treat the whole input as raw shader source
    $('simple-stats').textContent = 'No tagged shader literal found — minified as raw shader source.';
    return;
  }

  let out = code;
  let before = 0;
  let after = 0;
  // Replace back-to-front so earlier offsets stay valid.
  for (const { value, start, end } of [...literals].sort((a, b) => b.start - a.start)) {
    const min = minifyShader(value);
    before += value.length;
    after += min.length;
    out = out.slice(0, start) + '`' + min + '`' + out.slice(end);
  }
  $('output').value = out;
  const pct = before ? (((before - after) / before) * 100).toFixed(1) : '0.0';
  $('simple-stats').textContent = `${literals.length} shader(s): ${before} → ${after} bytes (${pct}% smaller)`;
}

$('run-simple').addEventListener('click', runSimple);
runSimple();

$('copy-output').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('output').value);
  const btn = $('copy-output');
  const original = btn.textContent;
  btn.textContent = 'Copied!';
  setTimeout(() => (btn.textContent = original), 1200);
});

// --- View 2: real npm package via WebContainer --------------------------

const wcSupported = typeof SharedArrayBuffer !== 'undefined' && window.crossOriginIsolated;
$('wc-support').textContent = wcSupported
  ? ''
  : 'WebContainers need a Chromium browser with cross-origin isolation — reload if the page just registered a service worker, or try Chrome/Edge.';

const runPkgBtn = $('run-pkg');
const pkgLog = $('pkg-log');
const pkgResult = $('pkg-result');

function log(text) {
  pkgLog.textContent += text;
  pkgLog.scrollTop = pkgLog.scrollHeight;
}

function renderResult(pkgName, { count, before, after, samples }) {
  if (count === 0) {
    pkgResult.innerHTML = `<p class="hint">No shader-shaped template literals found in <code>${pkgName}</code>.</p>`;
    return;
  }
  const pct = (((before - after) / before) * 100).toFixed(1);
  const sampleRows = samples
    .map((s) => `<tr><td>${s.file}</td><td>${s.before.length} B</td><td>${s.after.length} B</td></tr>`)
    .join('');
  pkgResult.innerHTML = `
    <table>
      <tr><th>Shaders found</th><td>${count}</td></tr>
      <tr><th>Before</th><td>${before.toLocaleString()} B</td></tr>
      <tr><th>After</th><td>${after.toLocaleString()} B</td></tr>
      <tr><th>Saved</th><td class="saved">${pct}%</td></tr>
    </table>
    ${samples.length ? `<table><tr><th>Sample file</th><th>Before</th><th>After</th></tr>${sampleRows}</table>` : ''}
  `;
}

runPkgBtn.addEventListener('click', async () => {
  const pkgName = $('pkg-name').value.trim();
  if (!pkgName) return;

  runPkgBtn.disabled = true;
  pkgLog.textContent = '';
  pkgResult.innerHTML = '';
  log(`Booting WebContainer and installing ${pkgName}...\n`);

  try {
    const result = await scanPackage(pkgName, log);
    renderResult(pkgName, result);
  } catch (err) {
    log(`\n${err.message}\n`);
  } finally {
    runPkgBtn.disabled = false;
  }
});
