import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
export default async function teardown() {
  let token: string;
  try {
    ({ token } = JSON.parse(
      await readFile(new URL('../backend/.local/e2e-session.json', import.meta.url), 'utf8'),
    ));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  await Promise.all(
    [4001, 5174].map((port) =>
      fetch(`http://localhost:${port}/__e2e__/shutdown`, {
        method: 'POST',
        headers: { 'X-E2E-Token': token },
        signal: AbortSignal.timeout(5000),
      }).catch(() => null),
    ),
  );

  const backend = fileURLToPath(new URL('../backend/', import.meta.url));
  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('../backend/node_modules/tsx/dist/cli.mjs', import.meta.url)),
      'scripts/e2e-cleanup.ts',
    ],
    { cwd: backend, windowsHide: true, stdio: 'inherit', timeout: 10000 },
  );
}
