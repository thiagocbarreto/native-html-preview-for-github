import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertPublishAllowed,
  compareVersions,
  createStore,
  versionParts,
} from '../../scripts/chrome-store.mts';

const itemId = 'eogkbedpfhpdjlbmehjfigaehdaieaca';
const zip = new Uint8Array([1, 2, 3]);

function revision(version: string, state: string) {
  return { state, distributionChannels: [{ crxVersion: version }] };
}

const published = {
  publishedItemRevisionStatus: revision('0.2.0', 'PUBLISHED'),
};
const pending = {
  ...published,
  submittedItemRevisionStatus: revision('0.2.1', 'PENDING_REVIEW'),
};

function harness(responses: unknown[], pollAttempts = 2) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const messages: string[] = [];
  let sleeps = 0;
  const store = createStore(
    {
      publisherId: 'test-publisher',
      itemId,
      token: 'fixture-token',
      requestTimeoutMs: 1000,
      uploadPollIntervalMs: 1,
      uploadPollAttempts: pollAttempts,
    },
    {
      fetch: async (input, init) => {
        assert.ok(init);
        calls.push({ url: String(input), init });
        assert.equal(
          new URL(String(input)).origin,
          'https://chromewebstore.googleapis.com'
        );
        assert.equal(
          new Headers(init.headers).get('Authorization'),
          'Bearer fixture-token'
        );
        assert.equal(init.redirect, 'error');
        assert.ok(responses.length > 0, 'Unexpected request');
        const response = responses.shift();
        return response instanceof Response
          ? response
          : Response.json(response);
      },
      log: (message) => messages.push(message),
      sleep: async () => {
        sleeps += 1;
      },
    }
  );
  return { store, calls, messages, sleeps: () => sleeps };
}

test('status check sends only a GET and does not log credentials', async () => {
  const { store, calls, messages } = harness([published]);
  await store.status();
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.init.method, 'GET');
  assert.match(calls[0]?.url ?? '', /:fetchStatus$/);
  assert.deepEqual(messages, ['Published: 0.2.0 (PUBLISHED)']);
});

test('release uploads the package and submits it for normal review', async () => {
  const { store, calls, messages } = harness([
    published,
    { uploadState: 'SUCCEEDED', crxVersion: '0.2.1' },
    { state: 'PENDING_REVIEW' },
    pending,
  ]);
  await store.publish(zip, '0.2.1');
  assert.deepEqual(
    calls.map((call) => call.init.method),
    ['GET', 'POST', 'POST', 'GET']
  );
  assert.match(calls[1]?.url ?? '', /\/upload\/v2\/.+:upload$/);
  assert.ok(calls[1]?.init.body instanceof Blob);
  assert.deepEqual(JSON.parse(String(calls[2]?.init.body)), {
    publishType: 'DEFAULT_PUBLISH',
    skipReview: false,
    blockOnWarnings: true,
  });
  assert.equal(messages.at(-1), 'Confirmed 0.2.1: PENDING_REVIEW');
});

test('rerunning an already published version does not upload again', async () => {
  const { store, calls } = harness([
    {
      publishedItemRevisionStatus: revision('0.2.1', 'PUBLISHED'),
    },
  ]);
  await store.publish(zip, '0.2.1');
  assert.equal(calls.length, 1);
});

for (const state of ['PENDING_REVIEW', 'STAGED']) {
  test(`rerunning an existing ${state} submission does not mutate it`, async () => {
    const { store, calls } = harness([
      {
        ...published,
        submittedItemRevisionStatus: revision('0.2.1', state),
      },
    ]);
    await store.publish(zip, '0.2.1');
    assert.equal(calls.length, 1);
  });
}

test('another pending revision blocks a release', async () => {
  const { store, calls } = harness([pending]);
  await assert.rejects(
    store.publish(zip, '0.2.2'),
    /Another version is pending/
  );
  assert.equal(calls.length, 1);
});

test('a lower version or unknown store state cannot upload', async () => {
  for (const status of [
    published,
    { publishedItemRevisionStatus: revision('0.1', 'UNKNOWN') },
  ]) {
    const { store, calls } = harness([status]);
    await assert.rejects(
      store.publish(zip, '0.1.5'),
      /greater than|Unknown store/
    );
    assert.equal(calls.length, 1);
  }
});

test('a failed upload never submits for review', async () => {
  const { store, calls } = harness([published, { uploadState: 'FAILED' }]);
  await assert.rejects(
    store.publish(zip, '0.2.1'),
    /no publish request was sent/
  );
  assert.equal(calls.length, 2);
});

for (const uploadState of ['IN_PROGRESS', 'UPLOAD_IN_PROGRESS']) {
  test(`an ${uploadState} upload is polled before publishing`, async () => {
    const { store, calls, sleeps } = harness([
      published,
      { uploadState },
      { ...published, lastAsyncUploadState: 'SUCCEEDED' },
      { state: 'PENDING_REVIEW' },
      pending,
    ]);
    await store.publish(zip, '0.2.1');
    assert.equal(sleeps(), 1);
    assert.deepEqual(
      calls.map((call) => call.init.method),
      ['GET', 'POST', 'GET', 'POST', 'GET']
    );
  });
}

test('upload polling is bounded and does not publish on timeout', async () => {
  const { store, calls, sleeps } = harness([
    published,
    { uploadState: 'IN_PROGRESS' },
    { ...published, lastAsyncUploadState: 'IN_PROGRESS' },
    { ...published, lastAsyncUploadState: 'IN_PROGRESS' },
  ]);
  await assert.rejects(
    store.publish(zip, '0.2.1'),
    /no publish request was sent/
  );
  assert.equal(sleeps(), 2);
  assert.equal(calls.filter((call) => call.url.endsWith(':publish')).length, 0);
});

test('an upload version mismatch prevents publishing', async () => {
  const { store, calls } = harness([
    published,
    { uploadState: 'SUCCEEDED', crxVersion: '0.3.0' },
  ]);
  await assert.rejects(store.publish(zip, '0.2.1'), /differs from the package/);
  assert.equal(calls.length, 2);
});

test('a competing submission is detected instead of reported as success', async () => {
  const { store } = harness([
    published,
    { uploadState: 'SUCCEEDED', crxVersion: '0.2.1' },
    { state: 'PENDING_REVIEW' },
    { submittedItemRevisionStatus: revision('0.3.0', 'PENDING_REVIEW') },
  ]);
  await assert.rejects(store.publish(zip, '0.2.1'), /Could not confirm/);
});

test('HTTP failures never include raw response contents in errors', async () => {
  const { store, messages } = harness([
    new Response('sensitive-response', { status: 403 }),
  ]);
  await assert.rejects(store.status(), (error) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /HTTP 403/);
    assert.doesNotMatch(error.message, /sensitive-response|fixture-token/);
    return true;
  });
  assert.deepEqual(messages, []);
});

test('policy enforcement, malformed versions, and ambiguous channels fail closed', async () => {
  for (const payload of [
    { takenDown: true },
    { warned: true },
    { publishedItemRevisionStatus: revision('not-a-version', 'PUBLISHED') },
    {
      publishedItemRevisionStatus: {
        state: 'PUBLISHED',
        distributionChannels: [],
      },
    },
    { ...published, lastAsyncUploadState: 'IN_PROGRESS' },
  ]) {
    const { store, calls } = harness([payload]);
    await assert.rejects(store.publish(zip, '0.2.1'));
    assert.equal(calls.length, 1);
  }
});

test('Chrome versions compare numerically with missing components padded', () => {
  assert.equal(compareVersions('1.10', '1.9.9'), 1);
  assert.equal(compareVersions('1', '1.0.0.0'), 0);
  for (const version of ['0', '01.2', '1.65536', '1.2.3.4.5', 'v1.2']) {
    assert.throws(() => versionParts(version), /Invalid Chrome/);
  }
});

test('publishing requires both opt-in and the exact release-tag push', () => {
  const allowed = {
    CWS_PUBLISH_ENABLED: 'true',
    GITHUB_EVENT_NAME: 'push',
    GITHUB_REF: 'refs/tags/v0.2.1',
  };
  assert.doesNotThrow(() => assertPublishAllowed(allowed, '0.2.1'));
  for (const overrides of [
    { CWS_PUBLISH_ENABLED: 'false' },
    { GITHUB_EVENT_NAME: 'workflow_dispatch' },
    { GITHUB_REF: 'refs/heads/main' },
    { GITHUB_REF: 'refs/tags/v0.2.2' },
  ]) {
    assert.throws(
      () => assertPublishAllowed({ ...allowed, ...overrides }, '0.2.1'),
      /enabled release-tag push/
    );
  }
});
