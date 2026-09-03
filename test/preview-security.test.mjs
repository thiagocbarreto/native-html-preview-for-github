import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(
  new URL('../src/preview-security.js', import.meta.url),
  'utf8'
);
const context = vm.createContext({ URL });
vm.runInContext(source, context);
const { contentSecurityPolicy, trustedRawUrl } =
  context.NativeHtmlPreviewSecurity;

test('active mode allows secure scripts, assets, and connections', () => {
  const policy = contentSecurityPolicy(true);

  assert.match(policy, /script-src 'unsafe-inline' https:/);
  assert.match(policy, /connect-src https: wss:/);
  assert.match(policy, /style-src 'unsafe-inline' https:/);
  assert.doesNotMatch(policy, /unsafe-eval/);
});

test('restricted mode blocks scripts and external connections', () => {
  const policy = contentSecurityPolicy(false);

  assert.match(policy, /script-src 'none'/);
  assert.match(policy, /connect-src 'none'/);
  assert.match(policy, /img-src data: blob:/);
  assert.doesNotMatch(policy, /script-src[^;]*https:/);
});

test('both modes block privileged embedding and submission', () => {
  for (const active of [true, false]) {
    const policy = contentSecurityPolicy(active);
    assert.match(policy, /default-src 'none'/);
    assert.match(policy, /frame-src 'none'/);
    assert.match(policy, /object-src 'none'/);
    assert.match(policy, /form-action 'none'/);
  }
});

test('raw source URLs stay within the current repository', () => {
  const page = 'https://github.com/owner/repo/blob/main/docs/page.html';

  assert.equal(
    trustedRawUrl('https://github.com/owner/repo/raw/main/docs/page.html', page),
    'https://github.com/owner/repo/raw/main/docs/page.html'
  );
  assert.equal(
    trustedRawUrl(
      'https://raw.githubusercontent.com/owner/repo/main/docs/page.html',
      page
    ),
    'https://raw.githubusercontent.com/owner/repo/main/docs/page.html'
  );
  assert.throws(() =>
    trustedRawUrl('https://example.com/owner/repo/page.html', page)
  );
  assert.throws(() =>
    trustedRawUrl('https://github.com/other/repo/raw/main/page.html', page)
  );
});
