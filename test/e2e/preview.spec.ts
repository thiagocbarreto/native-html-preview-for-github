import type { Page } from '@playwright/test';
import { expect, test } from './extension.fixture';
import { githubFilePage } from './github-page';

const blobUrl = 'https://github.com/test/repo/blob/main/index.html';

async function mockGitHub(page: Page, assetOrigin: string): Promise<void> {
  await page.route(`${blobUrl}*`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: githubFilePage(assetOrigin),
    })
  );
}

test.beforeEach(async ({ assetServer, page, serviceWorker }) => {
  await serviceWorker.evaluate(() => chrome.storage.local.clear());
  await mockGitHub(page, assetServer.origin);
});

test('renders active repository HTML inside the isolated frame', async ({
  page,
}) => {
  await page.goto(blobUrl);
  await page.getByRole('button', { name: 'HTML', exact: true }).click();

  await expect(page).toHaveURL(`${blobUrl}?native-html=preview`);
  await expect(page.locator('#source')).toBeHidden();
  await expect(page.locator('#file-metadata')).toBeVisible();
  await expect(page.getByRole('status')).toContainText(
    'Active content enabled'
  );
  const frameElement = page.locator('.native-html-preview__frame');
  await expect(frameElement).toHaveAttribute('sandbox', 'allow-scripts');

  const frame = page.frameLocator('.native-html-preview__frame');
  await expect(frame.locator('#inline-status')).toHaveText('Inline script ran');
  await expect(frame.locator('#external-status')).toHaveText(
    'External script ran'
  );
  await expect(frame.locator('#network-status')).toHaveText(
    'Network request completed'
  );
  await expect(frame.locator('iframe')).toHaveCount(0);

  const previewFrame = page
    .frames()
    .find((candidate) => candidate !== page.mainFrame());
  expect(previewFrame).toBeDefined();
  expect(await previewFrame?.evaluate(() => location.origin)).toBe('null');
  expect(
    await previewFrame?.evaluate(
      () => typeof chrome === 'undefined' || chrome.runtime === undefined
    )
  ).toBe(true);
});

test('renders and restores source with module-prefixed GitHub classes', async ({
  assetServer,
  page,
}) => {
  await page.route(`${blobUrl}*`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: githubFilePage(assetServer.origin, 'module-prefixed'),
    })
  );
  await page.goto(`${blobUrl}?native-html=preview`);

  await expect(page.locator('#source')).toBeHidden();
  await expect(page.locator('#file-metadata')).toBeVisible();
  await expect(
    page.frameLocator('.native-html-preview__frame').locator('#inline-status')
  ).toHaveText('Inline script ran');

  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await expect(page.locator('#source')).toBeVisible();
  await expect(page.locator('.native-html-preview')).toHaveCount(0);
});

test('warning setting hides trusted notice without disabling scripts', async ({
  context,
  extensionId,
  page,
  serviceWorker,
}) => {
  await page.goto(`${blobUrl}?native-html=preview`);
  await expect(page.getByRole('status')).toContainText(
    'Active content enabled'
  );

  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${extensionId}/sidepanel/index.html`);
  const toggle = settings.getByRole('switch', {
    name: 'Show active-content warning',
  });
  await expect(toggle).toBeChecked();
  await toggle.click();

  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.locator('.native-html-preview__frame')).toHaveAttribute(
    'sandbox',
    'allow-scripts'
  );
  await expect(
    page.frameLocator('.native-html-preview__frame').locator('#inline-status')
  ).toHaveText('Inline script ran');
  expect(
    await serviceWorker.evaluate(() =>
      chrome.storage.local
        .get('showActiveContentWarning')
        .then((stored) => stored.showActiveContentWarning)
    )
  ).toBe(false);
});

test('restricted setting removes scripts and outbound navigation', async ({
  context,
  extensionId,
  page,
}) => {
  await page.goto(`${blobUrl}?native-html=preview`);
  await expect(page.getByRole('status')).toContainText(
    'Active content enabled'
  );

  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${extensionId}/sidepanel/index.html`);
  const toggle = settings.getByRole('switch', { name: 'Allow active content' });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(settings.getByText('Restricted mode is on.')).toBeVisible();

  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.locator('.native-html-preview__frame')).toHaveAttribute(
    'sandbox',
    ''
  );
  const frame = page.frameLocator('.native-html-preview__frame');
  await expect(frame.locator('#inline-status')).toHaveText('Scripts blocked');
  await expect(frame.locator('#external-status')).toHaveText(
    'External script blocked'
  );
  await expect(frame.locator('#network-status')).toHaveText('Network blocked');
  await expect(frame.locator('#external-link')).not.toHaveAttribute(
    'href',
    /.+/
  );
  await expect(frame.locator('script')).toHaveCount(0);
});

test('restores source and follows GitHub soft navigation', async ({ page }) => {
  await page.goto(`${blobUrl}?native-html=preview`);
  await expect(page.locator('.native-html-preview')).toBeVisible();

  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await expect(page).toHaveURL(blobUrl);
  await expect(page.locator('#source')).toBeVisible();
  await expect(page.locator('.native-html-preview')).toHaveCount(0);

  await page.evaluate(() => {
    history.pushState(
      {},
      '',
      '/test/repo/blame/main/index.html?native-html=preview'
    );
    document.dispatchEvent(new Event('soft-nav:end'));
  });

  await expect(page).toHaveURL(
    'https://github.com/test/repo/blame/main/index.html?native-html=preview'
  );
  await expect(page.locator('.native-html-preview__frame')).toBeVisible();
});
