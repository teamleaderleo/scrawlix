import { expect, test } from '@playwright/test';
import {
  extensionHighlightRanges,
  extensionWithPregrantedHosts,
  launchExtensionContext,
} from './extension-harness';

test('built extension stays idempotent across dense SPA mutation batches', async ({}, testInfo) => {
  const extensionPath = await extensionWithPregrantedHosts(
    testInfo.outputPath('spa-extension-under-test')
  );
  const context = await launchExtensionContext(
    testInfo.outputPath('spa-extension-profile'),
    extensionPath
  );

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('http://127.0.0.1:4174/fixture.html');
    const fixtureUrl = page.url();

    await page.evaluate(() => {
      const section = document.createElement('section');
      section.id = 'spa-batch';
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < 300; index += 1) {
        const paragraph = document.createElement('p');
        paragraph.id = `spa-row-${index}`;
        paragraph.dataset.row = String(index);
        paragraph.textContent = `row ${index} fuck arrived`;
        fragment.append(paragraph);
      }
      section.append(fragment);
      document.querySelector('main')?.append(section);
    });

    const rows = page.locator('#spa-batch > p');
    await expect(rows).toHaveCount(300);
    await expect
      .poll(async () =>
        (await extensionHighlightRanges(context, fixtureUrl)).filter(range =>
          range.parentId?.startsWith('spa-row-')
        ).length
      )
      .toBe(300);
    await expect(page.locator('#spa-batch [data-scrawlix-dom-root]')).toHaveCount(0);

    await page.evaluate(() => {
      for (const paragraph of document.querySelectorAll<HTMLElement>('#spa-batch > p')) {
        paragraph.textContent = `updated ${paragraph.dataset.row} fuck again`;
      }
    });

    await expect
      .poll(async () =>
        (await extensionHighlightRanges(context, fixtureUrl)).filter(range =>
          range.parentId?.startsWith('spa-row-')
        ).length
      )
      .toBe(300);
    await expect(page.locator('#spa-batch > p').first()).toHaveText(
      'updated 0 fuck again'
    );
    await expect(page.locator('#spa-batch [data-scrawlix-dom-root]')).toHaveCount(0);
    expect(
      (await extensionHighlightRanges(context, fixtureUrl)).some(
        range =>
          range.parentId === 'spa-row-0' &&
          range.sourceText === 'updated 0 fuck again' &&
          range.text === 'uc'
      )
    ).toBe(true);

    await page.evaluate(() => {
      const section = document.querySelector('#spa-batch');
      const fragment = document.createDocumentFragment();
      for (let index = 300; index < 500; index += 1) {
        const paragraph = document.createElement('p');
        paragraph.id = `spa-row-${index}`;
        paragraph.dataset.row = String(index);
        paragraph.textContent = `late row ${index} fuck arrived`;
        fragment.append(paragraph);
      }
      section?.append(fragment);
    });

    await expect(rows).toHaveCount(500);
    await expect
      .poll(async () =>
        (await extensionHighlightRanges(context, fixtureUrl)).filter(range =>
          range.parentId?.startsWith('spa-row-')
        ).length
      )
      .toBe(500);
    await expect(page.locator('#spa-batch [data-scrawlix-dom-root]')).toHaveCount(0);

    const ranges = await extensionHighlightRanges(context, fixtureUrl);
    expect(ranges.some(range => range.parentId === 'native-button')).toBe(false);
    expect(ranges.some(range => range.parentId === 'editable')).toBe(false);
  } finally {
    await context.close();
  }
});
