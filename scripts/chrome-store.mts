// Checks store access by default. --publish uploads and submits only an explicitly enabled release tag.
// Logs contain revision state, never credentials or raw API responses. See docs/CHROME_STORE_RELEASES.md for recovery.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

interface Revision {
  state: string;
  version: string;
}

interface StoreStatus {
  published?: Revision;
  submitted?: Revision;
  uploadState?: string;
}

interface StoreOptions {
  publisherId: string;
  itemId: string;
  token: string;
  requestTimeoutMs: number;
  uploadPollIntervalMs: number;
  uploadPollAttempts: number;
}

interface StoreDependencies {
  fetch: typeof fetch;
  log: (message: string) => void;
  sleep: (milliseconds: number) => Promise<void>;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Unexpected store response');
  }
  return value as Record<string, unknown>;
}

export function versionParts(version: string): number[] {
  if (!/^(0|[1-9]\d*)(\.(0|[1-9]\d*)){0,3}$/.test(version)) {
    throw new Error('Invalid Chrome extension version');
  }
  const parts = version.split('.').map(Number);
  if (parts.some((part) => part > 65535) || parts.every((part) => part === 0)) {
    throw new Error('Invalid Chrome extension version');
  }
  return Array.from({ length: 4 }, (_, index) => parts[index] ?? 0);
}

export function compareVersions(left: string, right: string): number {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let index = 0; index < a.length; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function revision(value: unknown): Revision | undefined {
  if (value === undefined) return undefined;
  const item = object(value);
  const channels = item.distributionChannels;
  if (
    typeof item.state !== 'string' ||
    !Array.isArray(channels) ||
    channels.length !== 1
  ) {
    throw new Error(
      'Store revision must have one identifiable release channel'
    );
  }
  const channel = object(channels[0]);
  if (typeof channel.crxVersion !== 'string') {
    throw new Error('Store revision is missing its version');
  }
  versionParts(channel.crxVersion);
  return { state: item.state, version: channel.crxVersion };
}

export function createStore(
  options: StoreOptions,
  dependencies: StoreDependencies
) {
  if (
    !/^[\w-]+$/.test(options.publisherId) ||
    !/^[a-p]{32}$/.test(options.itemId)
  ) {
    throw new Error('Invalid publisher or extension ID');
  }
  const item = `publishers/${options.publisherId}/items/${options.itemId}`;
  const origin = 'https://chromewebstore.googleapis.com';
  const { log } = dependencies;

  async function request(
    method: string,
    suffix: string,
    body?: BodyInit,
    upload = false
  ): Promise<Record<string, unknown>> {
    const response = await dependencies
      .fetch(`${origin}/${upload ? 'upload/' : ''}v2/${item}:${suffix}`, {
        method,
        headers: {
          Authorization: `Bearer ${options.token}`,
          ...(body
            ? {
                'Content-Type': upload ? 'application/zip' : 'application/json',
              }
            : {}),
        },
        ...(body ? { body } : {}),
        redirect: 'error',
        signal: AbortSignal.timeout(options.requestTimeoutMs),
      })
      .catch(() => {
        throw new Error(
          'Store network request failed; inspect status before retrying a submission'
        );
      });
    if (!response.ok) {
      throw new Error(
        `Store ${suffix} failed (HTTP ${response.status}); check publisher access and the developer dashboard`
      );
    }
    return object(await response.json());
  }

  async function status(): Promise<StoreStatus> {
    const result = await request('GET', 'fetchStatus');
    if (result.takenDown === true || result.warned === true) {
      throw new Error(
        'Store policy enforcement requires attention in the developer dashboard'
      );
    }
    const published = revision(result.publishedItemRevisionStatus);
    const submitted = revision(result.submittedItemRevisionStatus);
    if (published) log(`Published: ${published.version} (${published.state})`);
    if (submitted) log(`Submitted: ${submitted.version} (${submitted.state})`);
    if (!published && !submitted) log('No published or submitted revision');
    return {
      ...(published ? { published } : {}),
      ...(submitted ? { submitted } : {}),
      ...(typeof result.lastAsyncUploadState === 'string'
        ? { uploadState: result.lastAsyncUploadState }
        : {}),
    };
  }

  async function publish(zip: Uint8Array, version: string): Promise<void> {
    versionParts(version);
    const before = await status();
    if (
      before.published &&
      compareVersions(version, before.published.version) === 0
    ) {
      log('Skip: this version is already published');
      return;
    }
    const active = before.submitted;
    if (active && ['PENDING_REVIEW', 'STAGED'].includes(active.state)) {
      if (compareVersions(version, active.version) === 0) {
        log(`Skip: this version is already ${active.state}`);
        return;
      }
      throw new Error(
        'Another version is pending review or staged; refusing to replace it'
      );
    }
    for (const existing of [before.published, active]) {
      if (existing && compareVersions(version, existing.version) <= 0) {
        throw new Error(
          'Release version must be greater than existing store revisions'
        );
      }
      if (
        existing &&
        ![
          'PUBLISHED',
          'PUBLISHED_TO_TESTERS',
          'REJECTED',
          'CANCELLED',
        ].includes(existing.state)
      ) {
        throw new Error('Unknown store revision state; refusing to upload');
      }
    }
    if (
      before.uploadState &&
      before.uploadState !== 'SUCCEEDED' &&
      before.uploadState !== 'FAILED' &&
      before.uploadState !== 'NOT_FOUND'
    ) {
      throw new Error('Another upload may be in progress; refusing to upload');
    }

    log(`Upload version ${version}`);
    const upload = await request(
      'POST',
      'upload',
      new Blob([new Uint8Array(zip)]),
      true
    );
    let uploadState = upload.uploadState;
    // The upload method and enum docs use different names for an in-progress upload.
    for (
      let attempt = 0;
      ['IN_PROGRESS', 'UPLOAD_IN_PROGRESS'].includes(String(uploadState)) &&
      attempt < options.uploadPollAttempts;
      attempt += 1
    ) {
      await dependencies.sleep(options.uploadPollIntervalMs);
      uploadState = (await status()).uploadState;
    }
    if (uploadState !== 'SUCCEEDED') {
      throw new Error(
        'Upload did not finish successfully; no publish request was sent'
      );
    }
    if (upload.crxVersion !== undefined && upload.crxVersion !== version) {
      throw new Error(
        'Uploaded version differs from the package manifest; refusing to publish'
      );
    }

    log('Submit for review; approval and user updates happen later');
    const submission = await request(
      'POST',
      'publish',
      JSON.stringify({
        publishType: 'DEFAULT_PUBLISH',
        skipReview: false,
        blockOnWarnings: true,
      })
    );
    if (!['PENDING_REVIEW', 'PUBLISHED'].includes(String(submission.state))) {
      throw new Error(
        'Unexpected submission state; inspect the dashboard before retrying'
      );
    }
    const after = await status();
    const confirmed = [after.submitted, after.published].some(
      (item) => item?.version === version && item.state === submission.state
    );
    if (!confirmed) {
      throw new Error(
        'Could not confirm the submitted version; inspect the dashboard before retrying'
      );
    }
    log(`Confirmed ${version}: ${submission.state}`);
  }

  return { status, publish };
}

export function assertPublishAllowed(
  environment: NodeJS.ProcessEnv,
  version: string
): void {
  const approvedTrigger =
    environment.GITHUB_EVENT_NAME === 'push' ||
    (environment.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
      environment.CWS_MANUAL_PUBLISH_CONFIRMED === 'true');
  if (
    environment.CWS_PUBLISH_ENABLED !== 'true' ||
    !approvedTrigger ||
    environment.GITHUB_REF !== `refs/tags/v${version}`
  ) {
    throw new Error(
      'Publishing requires an enabled release tag matching the package version and an approved trigger'
    );
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required setting: ${name}`);
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (Number.isSafeInteger(value) && value > 0) return value;
  console.warn(`Invalid ${name}; using its default`);
  return fallback;
}

async function main(): Promise<void> {
  const directory =
    process.env.CWS_LOG_DIR ??
    path.join(
      process.env.XDG_STATE_HOME ?? path.join(homedir(), '.local/state'),
      'native-html-preview-for-github/releases'
    );
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const logPath = path.join(directory, `${Date.now()}-${process.pid}.log`);
  const log = (message: string): void => {
    const line = `[${new Date().toISOString()}] ${message}`;
    appendFileSync(logPath, `${line}\n`, { mode: 0o600 });
    console.log(line);
  };
  log(`Log: ${logPath}`);
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args[0] && args[0] !== '--publish'))
      throw new Error('Usage: node scripts/chrome-store.mts [--publish]');
    const store = createStore(
      {
        publisherId: required('CWS_PUBLISHER_ID'),
        itemId: required('CWS_ITEM_ID'),
        token: required('CWS_ACCESS_TOKEN'),
        requestTimeoutMs: positiveInteger('CWS_REQUEST_TIMEOUT_MS', 60000),
        uploadPollIntervalMs: positiveInteger(
          'CWS_UPLOAD_POLL_INTERVAL_MS',
          5000
        ),
        uploadPollAttempts: positiveInteger('CWS_UPLOAD_POLL_ATTEMPTS', 12),
      },
      {
        fetch,
        log,
        sleep: (milliseconds) =>
          new Promise((resolve) => setTimeout(resolve, milliseconds)),
      }
    );
    if (args[0] !== '--publish') {
      log('Read-only store access check');
      await store.status();
    } else {
      const zipPath = required('CWS_ZIP_PATH');
      const manifest = object(
        JSON.parse(
          execFileSync('unzip', ['-p', zipPath, 'manifest.json'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
          })
        )
      );
      if (typeof manifest.version !== 'string')
        throw new Error('Package manifest is missing its version');
      assertPublishAllowed(process.env, manifest.version);
      await store.publish(await readFile(zipPath), manifest.version);
    }
    log('Success');
  } catch (error) {
    // Network exceptions can contain request internals. Only our own validation errors are shown.
    log(
      error instanceof Error && error.constructor === Error
        ? error.message
        : 'Store request failed; credentials and response bodies were withheld'
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await main();
}
