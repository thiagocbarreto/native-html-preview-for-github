import { execFileSync } from 'node:child_process';
import { cp, mkdir, readdir, rm, stat, utimes } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist/extension');
const timestamp = new Date('1980-01-01T00:00:00.000Z');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
execFileSync(
  process.execPath,
  [
    path.join(root, 'node_modules/typescript/bin/tsc'),
    '--project',
    path.join(root, 'tsconfig.build.json'),
  ],
  { stdio: 'inherit' }
);

for (const source of [
  'manifest.json',
  'src/content.css',
  'sidepanel/index.html',
  'sidepanel/sidepanel.css',
  'assets/icons',
]) {
  await cp(path.join(root, source), path.join(output, source), {
    recursive: true,
  });
}

async function normalizeTimestamps(directory) {
  for (const name of await readdir(directory)) {
    const entry = path.join(directory, name);
    if ((await stat(entry)).isDirectory()) {
      await normalizeTimestamps(entry);
    } else {
      await utimes(entry, timestamp, timestamp);
    }
  }
}

await normalizeTimestamps(output);
