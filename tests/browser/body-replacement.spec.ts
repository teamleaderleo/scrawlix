import { expect, test } from '@playwright/test';
import {
  extensionHighlightRanges,
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
    const fixtureUrl = page.url();

    await expect
      .poll(async () =>
        (await extensionHighlightRanges(context, fixtureUrl)).some(
          range => range.parentId === 'initial' && range.text === 'uc'
        )
      )
      .toBe(true);
    await expect(page.locator('#initial')).toHaveText('well, fuck this');
    await expect(page.locator('[data-scrawlix-dom-root]')).toHaveCount(0);

    await page.getByRole('button', { name: 'replace body' }).click();

    await expect(page.locator('#replacement')).toHaveText(
      'replacement fuck arrived'
    );
    await expect(page.locator('#replacement-link')).toHaveText('fuck');
    await expect(page.locator('[data-scrawlix-dom-root]')).toHaveCount(0);
    await expect
      .poll(async () => extensionHighlightRanges(context, fixtureUrl))
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({ parentId: 'replacement', text: 'uc' }),
          expect.objectContaining({ parentId: 'replacement-link', text: 'uc' }),
        ])
      );

    await page.locator('#replacement-link').click();
    await expect(page).toHaveURL('http://127.0.0.1:4174/clicked.html');
    await expect(page.locator('#clicked')).toHaveText('native link worked');
  } finally {
    await context.close();
  }
});
