import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

interface Manifest {
  action: { default_icon: Record<string, string> };
  background: { service_worker: string };
  content_scripts: Array<{
    css?: string[];
    js: string[];
    matches: string[];
  }>;
  description: string;
  host_permissions?: string[];
  icons: Record<string, string>;
  name: string;
  permissions: string[];
  side_panel: { default_path: string };
  version: string;
}

const root = new URL('../../', import.meta.url);
const extensionRoot = new URL('dist/extension/', root);
const manifest = JSON.parse(
  await readFile(new URL('manifest.json', extensionRoot), 'utf8')
) as Manifest;
const packageJson = JSON.parse(
  await readFile(new URL('package.json', root), 'utf8')
) as { version: string };
const [contentScript] = manifest.content_scripts;

if (!contentScript) {
  throw new Error('Manifest must declare a content script');
}

test('manifest and package versions match', () => {
  assert.equal(manifest.version, packageJson.version);
});

test('manifest declares only required access', () => {
  assert.deepEqual(manifest.permissions, ['sidePanel', 'storage']);
  assert.equal(manifest.host_permissions, undefined);
  assert.deepEqual(contentScript.matches, ['https://github.com/*']);
});

test('preview security loads before GitHub integration', () => {
  assert.deepEqual(contentScript.js, [
    'src/preview-security.js',
    'src/github-source.js',
    'src/preview-view.js',
    'src/content.js',
  ]);
});

test('manifest references packaged files', async () => {
  const files = [
    manifest.background.service_worker,
    manifest.side_panel.default_path,
    ...contentScript.js,
    ...(contentScript.css ?? []),
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
  ];

  await Promise.all(files.map((file) => access(new URL(file, extensionRoot))));
});

test('store-facing metadata fits Chrome limits', () => {
  assert.ok(manifest.name.length <= 45);
  assert.ok(manifest.description.length <= 132);
});
