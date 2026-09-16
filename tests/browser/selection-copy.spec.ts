import { expect, test } from '@playwright/test';
import {
  extensionHighlightRanges,
  extensionWithPregrantedHosts,
  launchExtensionContext,
} from './extension-harness';

function occurrences(value: string, needle: string) {
  return value.split(needle).length - 1;
}

const primaryModifier = process.platform === 'darwin' ? 'Meta' : 'Control';

test('built extension keeps selection and clipboard source literal exactly once', async ({}, testInfo) => {
  const extensionPath = await extensionWithPregrantedHosts(
    testInfo.outputPath('copy-extension-under-test')
  );
  const context = await launchExtensionContext(
    testInfo.outputPath('copy-extension-profile'),
    extensionPath
  );

  try {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://127.0.0.1:4174',
    });

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
    await expect(page.locator('[data-scrawlix-dom-root]')).toHaveCount(0);

    // The hostile-page audit explicitly calls out Select All → Copy. The page's
    // known source paragraph must appear exactly once in the native selection
    // and exactly once on the clipboard while Highlight coverage is active.
    await page.keyboard.press(`${primaryModifier}+A`);
    const selectedAll = await page.evaluate(() => getSelection()?.toString() ?? '');
    expect(occurrences(selectedAll, 'well, fuck this')).toBe(1);
    await page.keyboard.press(`${primaryModifier}+C`);
    const copiedAll = await page.evaluate(() => navigator.clipboard.readText());
    expect(occurrences(copiedAll, 'well, fuck this')).toBe(1);

    expect(
      await page.evaluate(() => {
        const paragraph = document.querySelector('#initial')!;
        const source = paragraph.firstChild;
        (window as Window & { __copySource?: ChildNode | null }).__copySource =
          source;

        const selection = getSelection()!;
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(paragraph);
        selection.addRange(range);
        return selection.toString();
      })
    ).toBe('well, fuck this');

    await page.keyboard.press(`${primaryModifier}+C`);
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe('well, fuck this');

    expect(
      await page.evaluate(() => {
        const paragraph = document.querySelector('#initial')!;
        return {
          sameSource:
            paragraph.firstChild ===
            (window as Window & { __copySource?: ChildNode | null }).__copySource,
          data: paragraph.firstChild?.nodeValue,
          children: paragraph.childNodes.length,
        };
      })
    ).toEqual({ sameSource: true, data: 'well, fuck this', children: 1 });

    await page.evaluate(() => {
      const source = (window as Window & { __copySource?: Text }).__copySource!;
      source.data = 'copy prefix fuck latest';
    });
    await expect(page.locator('#initial')).toHaveText('copy prefix fuck latest');
    await expect
      .poll(async () =>
        (await extensionHighlightRanges(context, fixtureUrl)).some(
          range =>
            range.parentId === 'initial' &&
            range.sourceText === 'copy prefix fuck latest'
        )
      )
      .toBe(true);

    expect(
      await page.evaluate(() => {
        const paragraph = document.querySelector('#initial')!;
        const selection = getSelection()!;
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(paragraph);
        selection.addRange(range);
        return selection.toString();
      })
    ).toBe('copy prefix fuck latest');

    await page.keyboard.press(`${primaryModifier}+C`);
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe('copy prefix fuck latest');

    expect(
      await page.evaluate(() => {
        const paragraph = document.querySelector('#initial')!;
        return {
          sameSource:
            paragraph.firstChild ===
            (window as Window & { __copySource?: ChildNode | null }).__copySource,
          data: paragraph.firstChild?.nodeValue,
          children: paragraph.childNodes.length,
        };
      })
    ).toEqual({
      sameSource: true,
      data: 'copy prefix fuck latest',
      children: 1,
    });
  } finally {
    await context.close();
  }
});
