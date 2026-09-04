import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  type BrowserContext,
  test as base,
  chromium,
  type Worker,
} from '@playwright/test';

interface AssetServer {
  origin: string;
}

interface ExtensionFixtures {
  assetServer: AssetServer;
  context: BrowserContext;
  extensionId: string;
  serviceWorker: Worker;
}

const execute = promisify(execFile);

export const test = base.extend<ExtensionFixtures>({
  assetServer: async ({ browserName }, use) => {
    if (browserName !== 'chromium') {
      throw new Error('Chrome extensions require Chromium');
    }
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'html-preview-e2e-')
    );
    const keyPath = path.join(directory, 'key.pem');
    const certificatePath = path.join(directory, 'certificate.pem');
    await execute('openssl', [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      keyPath,
      '-out',
      certificatePath,
      '-subj',
      '/CN=localhost',
      '-days',
      '1',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ]);

    const server = https.createServer(
      {
        key: await readFile(keyPath),
        cert: await readFile(certificatePath),
      },
      (request, response) => {
        if (request.url === '/library.js') {
          response.writeHead(200, { 'Content-Type': 'text/javascript' });
          response.end('globalThis.externalLibraryLoaded = true;');
          return;
        }
        if (request.url === '/status') {
          response.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'text/plain',
          });
          response.end('Network request completed');
          return;
        }
        response.writeHead(404);
        response.end();
      }
    );
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Could not start HTTPS fixture server');
    }

    try {
      await use({ origin: `https://127.0.0.1:${address.port}` });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await rm(directory, { recursive: true, force: true });
    }
  },

  context: async ({ browserName }, use) => {
    if (browserName !== 'chromium') {
      throw new Error('Chrome extensions require Chromium');
    }
    const extension = path.resolve('dist/extension');
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      args: [
        // Headless Chromium cannot grant loopback access to the opaque preview origin.
        '--disable-web-security',
        '--ignore-certificate-errors',
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    });

    await use(context);
    await context.close();
  },

  serviceWorker: async ({ context }, use) => {
    const existing = context.serviceWorkers()[0];
    const serviceWorker =
      existing ?? (await context.waitForEvent('serviceworker'));
    await use(serviceWorker);
  },

  extensionId: async ({ serviceWorker }, use) => {
    const extensionId = new URL(serviceWorker.url()).host;
    await use(extensionId);
  },
});

export { expect } from '@playwright/test';
