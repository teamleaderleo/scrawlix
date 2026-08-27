import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const extensionPath = resolve(process.cwd(), 'apps/extension/dist');

test('built extension rebinds after the page replaces document.body', async ({}, testInfo) => {
  const context = await chromium.launchPersistentContext(
    testInfo.outputPath('extension-body-replacement'),
    {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    }
  );

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('http://127.0.0.1:4174/fixture.html');
    await expect(page.locator('#initial [data-scrawlix-dom-root]')).toHaveCount(1);

    await page.getByRole('button', { name: 'replace body' }).click();

    await expect(
      page.locator('#replacement [data-scrawlix-dom-root]')
    ).toHaveCount(1);
    await expect(
      page.locator('#replacement [data-scrawlix-cover]')
    ).toHaveText('uc');
    await expect(
      page.locator('#replacement-link [data-scrawlix-dom-root]')
    ).toHaveCount(1);

    await page.locator('#replacement-link').click();
    await expect(page).toHaveURL('http://127.0.0.1:4174/clicked.html');
    await expect(page.locator('#clicked')).toHaveText('native link worked');
  } finally {
    await context.close();
  }
});
