import { expect, test } from '@playwright/test';
import {
  extensionHighlightRanges,
  extensionWithPregrantedHosts,
  launchExtensionContext,
} from './extension-harness';

test('built extension follows React-owned HostText updates, removals, and remounts', async ({}, testInfo) => {
  const testExtensionPath = await extensionWithPregrantedHosts(
    testInfo.outputPath('extension-under-test')
  );
  const context = await launchExtensionContext(
    testInfo.outputPath('extension-react-ownership'),
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

    await page.goto('http://127.0.0.1:4173/?ownership-fixture');
    const fixtureUrl = page.url();
    const owned = page.locator('#react-owned');
    await expect(owned).toHaveText('state: fuck 0');
    await expect(page.locator('[data-scrawlix-dom-root]')).toHaveCount(0);

    await page.evaluate(() => {
      const source = document.querySelector('#react-owned')?.lastChild ?? null;
      (window as Window & { __reactOwnedSource?: ChildNode | null })
        .__reactOwnedSource = source;
    });
    await expect
      .poll(async () => extensionHighlightRanges(context, fixtureUrl))
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            parentId: 'react-owned',
            text: 'uc',
            sourceText: 'fuck 0',
          }),
        ])
      );

    await page.locator('#react-increment').click();
    await expect(owned).toHaveText('state: fuck 1');
    expect(
      await page.evaluate(() => {
        const source = document.querySelector('#react-owned')?.lastChild ?? null;
        return {
          sameSource:
            source ===
            (window as Window & { __reactOwnedSource?: ChildNode | null })
              .__reactOwnedSource,
          data: source?.nodeValue,
        };
      })
    ).toEqual({ sameSource: true, data: 'fuck 1' });
    await expect
      .poll(async () => extensionHighlightRanges(context, fixtureUrl))
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            parentId: 'react-owned',
            text: 'uc',
            sourceText: 'fuck 1',
          }),
        ])
      );

    await page.locator('#react-toggle-text').click();
    await expect(owned).toHaveText('state: ');
    await expect
      .poll(async () =>
        (await extensionHighlightRanges(context, fixtureUrl)).some(
          range => range.parentId === 'react-owned'
        )
      )
      .toBe(false);

    await page.locator('#react-toggle-text').click();
    await expect(owned).toHaveText('state: fuck 1');
    expect(
      await page.evaluate(
        () => document.querySelector('#react-owned')?.lastChild?.nodeValue
      )
    ).toBe('fuck 1');
    await expect
      .poll(async () =>
        (await extensionHighlightRanges(context, fixtureUrl)).some(
          range => range.parentId === 'react-owned' && range.sourceText === 'fuck 1'
        )
      )
      .toBe(true);

    await page.locator('#react-toggle').click();
    await expect(page.locator('#react-unmounted')).toHaveText('unmounted');
    await expect
      .poll(async () =>
        (await extensionHighlightRanges(context, fixtureUrl)).some(
          range => range.parentId === 'react-owned'
        )
      )
      .toBe(false);

    await page.locator('#react-toggle').click();
    await expect(page.locator('#react-owned')).toHaveText('state: fuck 1');
    await expect
      .poll(async () =>
        (await extensionHighlightRanges(context, fixtureUrl)).some(
          range => range.parentId === 'react-owned' && range.sourceText === 'fuck 1'
        )
      )
      .toBe(true);
    await expect(page.locator('[data-scrawlix-dom-root]')).toHaveCount(0);

    expect(browserErrors).toEqual([]);
  } finally {
    await context.close();
  }
});
