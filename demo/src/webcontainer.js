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

/**
 * Installs `pkgName` (plus compress-shader-literals) in a fresh WebContainer
 * and runs scan.mjs against it. `onLog` gets streamed install/run output.
 * Resolves with `{ count, before, after, samples }`.
 */
export async function scanPackage(pkgName, onLog) {
  const container = await getContainer();

  await container.mount({
    'package.json': { file: { contents: containerPackageJson(pkgName) } },
    'scan.mjs': { file: { contents: scanScript } },
  });

  const install = await container.spawn('npm', ['install']);
  install.output.pipeTo(new WritableStream({ write: (chunk) => onLog(chunk) }));
  const installExit = await install.exit;
  if (installExit !== 0) throw new Error(`npm install failed (exit ${installExit}) — check the package name`);

  const run = await container.spawn('node', ['scan.mjs', pkgName]);
  let stdout = '';
  run.output.pipeTo(
    new WritableStream({
      write: (chunk) => {
        stdout += chunk;
        onLog(chunk);
      },
    })
  );
  const runExit = await run.exit;
  if (runExit !== 0) throw new Error(`scan failed (exit ${runExit})`);

  const marker = '__RESULT__';
  const line = stdout.split('\n').find((l) => l.startsWith(marker));
  if (!line) throw new Error('scan produced no result');
  return JSON.parse(line.slice(marker.length));
}
