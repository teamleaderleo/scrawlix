import { expect, test } from '@playwright/test';
import {
  extensionHighlightRanges,
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
    const fixtureUrl = page.url();
    const owned = page.locator('#hydration-owned');

    await expect(owned).toHaveText('state: fuck 0');
    const beforeHydration = await page.evaluate(() => {
      const paragraph = document.querySelector('#hydration-owned')!;
      const source = paragraph.lastChild;
      (window as Window & { __scrawlixHydrationSource?: ChildNode | null })
        .__scrawlixHydrationSource = source;
      return {
        childNodes: paragraph.childNodes.length,
        lastType: source?.nodeType,
        lastData: source?.nodeValue,
        html: paragraph.innerHTML,
        hydrated: (window as Window & { __scrawlixHydrated?: boolean })
          .__scrawlixHydrated,
      };
    });
    expect(beforeHydration).toEqual({
      childNodes: 2,
      lastType: 3,
      lastData: 'fuck 0',
      html: '<span>state: </span>fuck 0',
      hydrated: false,
    });
    await expect(page.locator('[data-scrawlix-dom-root]')).toHaveCount(0);
    await expect
      .poll(async () => extensionHighlightRanges(context, fixtureUrl))
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            parentId: 'hydration-owned',
            text: 'uc',
            sourceText: 'fuck 0',
            sameTextNode: true,
          }),
        ])
      );

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
    expect(
      await page.evaluate(() => {
        const paragraph = document.querySelector('#hydration-owned')!;
        return {
          sameSource:
            paragraph.lastChild ===
            (window as Window & { __scrawlixHydrationSource?: ChildNode | null })
              .__scrawlixHydrationSource,
          data: paragraph.lastChild?.nodeValue,
          html: paragraph.innerHTML,
        };
      })
    ).toEqual({
      sameSource: true,
      data: 'fuck 0',
      html: '<span>state: </span>fuck 0',
    });

    await page.locator('#hydration-increment').click();
    await expect(owned).toHaveText('state: fuck 1');
    expect(
      await page.evaluate(() => {
        const paragraph = document.querySelector('#hydration-owned')!;
        return {
          sameSource:
            paragraph.lastChild ===
            (window as Window & { __scrawlixHydrationSource?: ChildNode | null })
              .__scrawlixHydrationSource,
          data: paragraph.lastChild?.nodeValue,
        };
      })
    ).toEqual({ sameSource: true, data: 'fuck 1' });
    await expect
      .poll(async () => extensionHighlightRanges(context, fixtureUrl))
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            parentId: 'hydration-owned',
            text: 'uc',
            sourceText: 'fuck 1',
          }),
        ])
      );
  } finally {
    await context.close();
  }
});
