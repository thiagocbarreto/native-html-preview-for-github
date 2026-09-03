import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root)));
const packageJson = JSON.parse(await readFile(new URL('package.json', root)));

test('manifest and package versions match', () => {
  assert.equal(manifest.version, packageJson.version);
});

test('manifest declares only required access', () => {
  assert.deepEqual(manifest.permissions, ['sidePanel', 'storage']);
  assert.equal(manifest.host_permissions, undefined);
  assert.deepEqual(manifest.content_scripts[0].matches, [
    'https://github.com/*',
  ]);
});

test('preview security loads before GitHub integration', () => {
  assert.deepEqual(manifest.content_scripts[0].js, [
    'src/preview-security.js',
    'src/content.js',
  ]);
});

test('manifest references files included in the repository', async () => {
  const files = [
    manifest.background.service_worker,
    manifest.side_panel.default_path,
    ...manifest.content_scripts.flatMap(({ js, css = [] }) => [...js, ...css]),
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
  ];

  await Promise.all(files.map((file) => access(new URL(file, root))));
});

test('store-facing metadata fits Chrome limits', () => {
  assert.ok(manifest.name.length <= 45);
  assert.ok(manifest.description.length <= 132);
});
