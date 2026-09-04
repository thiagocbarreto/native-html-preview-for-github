import { expect, test } from './extension.fixture';

const live = process.env.LIVE_GITHUB_E2E === '1';

test.skip(!live, 'Set LIVE_GITHUB_E2E=1 to test current GitHub markup');

test('integrates with a public GitHub HTML file', async ({
  page,
  serviceWorker,
}) => {
  await serviceWorker.evaluate(() => chrome.storage.local.clear());
  await page.goto(
    'https://github.com/pompelmi/pompelmi/blob/main/docs/dashboard.html'
  );

  await page.getByRole('button', { name: 'HTML', exact: true }).click();
  await expect(page).toHaveURL(/native-html=preview/);
  await expect(page.getByRole('status')).toContainText(
    'Active content enabled'
  );
  await expect(page.locator('.native-html-preview__frame')).toHaveAttribute(
    'sandbox',
    'allow-scripts'
  );
});
