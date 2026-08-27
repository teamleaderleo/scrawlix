import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const extensionPath = resolve(process.cwd(), 'apps/extension/dist');

test('built extension follows React-owned HostText updates, removals, and remounts', async ({}, testInfo) => {
  const context = await chromium.launchPersistentContext(
    testInfo.outputPath('extension-react-ownership'),
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
    const browserErrors: string[] = [];
    page.on('console', message => {
      if (
        message.type() === 'error' &&
        !message.text().startsWith('Failed to load resource:')
      ) {
        browserErrors.push(message.text());
      }
    });
    page.on('pageerror', error => browserErrors.push(error.message));

    await page.goto('http://127.0.0.1:4173/?ownership-fixture');

    const owned = page.locator('#react-owned');
    await expect(owned.locator('[data-scrawlix-dom-root]')).toHaveCount(1);
    await expect(owned).toHaveText('state: fuck 0');

    await page.locator('#react-increment').click();
    await expect(owned).toHaveText('state: fuck 1');
    await expect(owned.locator('[data-scrawlix-dom-root]')).toHaveCount(1);

    await page.locator('#react-toggle-text').click();
    await expect(owned).toHaveText('state: ');
    await expect(owned.locator('[data-scrawlix-dom-root]')).toHaveCount(0);

    await page.locator('#react-toggle-text').click();
    await expect(owned).toHaveText('state: fuck 1');
    await expect(owned.locator('[data-scrawlix-dom-root]')).toHaveCount(1);

    await page.locator('#react-toggle').click();
    await expect(page.locator('#react-unmounted')).toHaveText('unmounted');
    await page.locator('#react-toggle').click();
    await expect(page.locator('#react-owned')).toHaveText('state: fuck 1');
    await expect(
      page.locator('#react-owned [data-scrawlix-dom-root]')
    ).toHaveCount(1);

    expect(browserErrors).toEqual([]);
  } finally {
    await context.close();
  }
});
