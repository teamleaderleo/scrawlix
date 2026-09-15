import { expect, test } from '@playwright/test';
import {
  extensionWithPregrantedHosts,
  launchExtensionContext,
} from './extension-harness';

test('built extension rebinds after the page replaces document.body', async ({}, testInfo) => {
  const testExtensionPath = await extensionWithPregrantedHosts(
    testInfo.outputPath('extension-under-test')
  );
  const context = await launchExtensionContext(
    testInfo.outputPath('extension-body-replacement'),
    testExtensionPath
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
