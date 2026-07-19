import { WebContainer } from '@webcontainer/api';
import scanScript from './scan.mjs?raw';

let bootPromise = null;

// WebContainer.boot() may only run once per page — cache the instance so
// repeated "Install & run" clicks reuse it instead of erroring.
function getContainer() {
  bootPromise ??= WebContainer.boot();
  return bootPromise;
}

function containerPackageJson(pkgName) {
  return JSON.stringify(
    {
      name: 'scan-sandbox',
      private: true,
      type: 'module',
      dependencies: {
        'compress-shader-literals': 'latest',
        '@babel/parser': '^8.0.0',
        '@babel/traverse': '^8.0.0',
        [pkgName]: 'latest',
      },
    },
    null,
    2
  );
}

// Installers to try, best first. `bun` isn't part of the WebContainer runtime
// (it ships Node.js, not the Bun binary) so it's here mainly so a future image
// that does bundle it gets picked up for free — the spawn just fails fast and
// falls through. pnpm/yarn come from corepack, which does ship with Node.
// Each uses its quiet/log-friendly flag instead of the default spinner, whose
// cursor-control codes are what render as "[1G[0K" garbage outside a real TTY.
const INSTALLERS = [
  { setup: null, bin: 'bun', args: ['install', '--no-progress'] },
  { setup: ['corepack', ['enable']], bin: 'pnpm', args: ['install', '--reporter=append-only'] },
  { setup: ['corepack', ['enable']], bin: 'yarn', args: ['install'] },
  { setup: null, bin: 'npm', args: ['install', '--loglevel=error', '--no-progress', '--no-fund', '--no-audit'] },
];

// Terminal spinners/progress bars work by re-drawing the same line with `\r`
// and ANSI cursor codes — fine on a real TTY, garbage once just appended to a
// log element. Strip escape sequences, then collapse each `\r`-delimited
// segment down to what would actually remain on screen (its last redraw).
function cleanTerminalOutput(str) {
  return str
    .replace(/\x1b\][^\x07]*(\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
    .replace(/\x1b/g, '')
    .replace(/[^\n]*\r(?!\n)/g, '');
}

async function runInstall(container, onLog) {
  for (const { setup, bin, args } of INSTALLERS) {
    try {
      if (setup) {
        const [setupBin, setupArgs] = setup;
        const setupProc = await container.spawn(setupBin, setupArgs);
        if ((await setupProc.exit) !== 0) continue;
      }
      const proc = await container.spawn(bin, args);
      proc.output.pipeTo(new WritableStream({ write: (chunk) => onLog(cleanTerminalOutput(chunk)) }));
      const exit = await proc.exit;
      if (exit === 0) return bin;
      onLog(`\n${bin} install failed (exit ${exit}) — trying the next package manager...\n`);
    } catch {
      // Binary not present in this WebContainer image — try the next one.
    }
  }
  throw new Error('No package manager (bun/pnpm/yarn/npm) could install the package');
}

/**
 * Installs `pkgName` (plus compress-shader-literals) in a fresh WebContainer
 * and runs scan.mjs against it. `onInstallLog`/`onScanLog` get streamed
 * output from each phase separately. Resolves with `{ count, before, after, samples }`.
 */
export async function scanPackage(pkgName, { onInstallLog, onScanLog, onInstaller }) {
  const container = await getContainer();

  await container.mount({
    'package.json': { file: { contents: containerPackageJson(pkgName) } },
    'scan.mjs': { file: { contents: scanScript } },
  });

  const usedInstaller = await runInstall(container, onInstallLog);
  onInstaller?.(usedInstaller);

  const marker = '__RESULT__';
  const run = await container.spawn('node', ['scan.mjs', pkgName]);
  let stdout = '';
  run.output.pipeTo(
    new WritableStream({
      write: (chunk) => {
        const clean = cleanTerminalOutput(chunk);
        stdout += clean;
        // The result line is a machine-readable payload for this UI, not log output.
        const visible = clean
          .split('\n')
          .filter((l) => !l.startsWith(marker))
          .join('\n');
        if (visible) onScanLog(visible);
      },
    })
  );
  const runExit = await run.exit;
  if (runExit !== 0) throw new Error(`scan failed (exit ${runExit})`);

  const line = stdout.split('\n').find((l) => l.startsWith(marker));
  if (!line) throw new Error('scan produced no result');
  return JSON.parse(line.slice(marker.length));
}
