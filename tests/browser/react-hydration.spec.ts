import { expect, test } from '@playwright/test';
import {
  extensionWithPregrantedHosts,
  launchExtensionContext,
} from './extension-harness';

test('built extension leaves delayed React hydration diagnostics at zero', async ({}, testInfo) => {
  const testExtensionPath = await extensionWithPregrantedHosts(
    testInfo.outputPath('extension-under-test')
  );
  const context = await launchExtensionContext(
    testInfo.outputPath('extension-react-hydration'),
    testExtensionPath
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

    await page.goto('http://127.0.0.1:4173/?hydration-fixture');

    const owned = page.locator('#hydration-owned');
    await expect(owned).toHaveText('state: fuck 0');
    await expect(owned.locator('[data-scrawlix-dom-root]')).toHaveCount(1);
    expect(
      await page.evaluate(
        () =>
          (window as Window & { __scrawlixHydrated?: boolean })
            .__scrawlixHydrated
      )
    ).toBe(false);

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as Window & { __scrawlixHydrated?: boolean })
              .__scrawlixHydrated
        )
      )
      .toBe(true);

    expect(browserErrors).toEqual([]);
    await expect(owned).toHaveText('state: fuck 0');
    await expect(owned.locator('[data-scrawlix-dom-root]')).toHaveCount(1);

    await page.locator('#hydration-increment').click();
    await expect(owned).toHaveText('state: fuck 1');
    await expect(owned.locator('[data-scrawlix-dom-root]')).toHaveCount(1);
  } finally {
    await context.close();
  }
});
