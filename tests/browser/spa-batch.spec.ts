import { expect, test } from '@playwright/test';
import {
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

    await page.evaluate(() => {
      const section = document.createElement('section');
      section.id = 'spa-batch';
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < 300; index += 1) {
        const paragraph = document.createElement('p');
        paragraph.dataset.row = String(index);
        paragraph.textContent = `row ${index} fuck arrived`;
        fragment.append(paragraph);
      }
      section.append(fragment);
      document.querySelector('main')?.append(section);
    });

    const rows = page.locator('#spa-batch > p');
    const roots = page.locator('#spa-batch > p > [data-scrawlix-dom-root]');
    const covers = page.locator('#spa-batch [data-scrawlix-cover]');
    await expect(rows).toHaveCount(300);
    await expect(roots).toHaveCount(300);
    await expect(covers).toHaveCount(300);
    await expect(
      page.locator('#spa-batch [data-scrawlix-dom-root] [data-scrawlix-dom-root]')
    ).toHaveCount(0);

    // Virtualized/feed-style pages often replace text inside existing row
    // containers. Reprocessing must stay one-root-per-row without nesting.
    await page.evaluate(() => {
      for (const paragraph of document.querySelectorAll<HTMLElement>('#spa-batch > p')) {
        paragraph.textContent = `updated ${paragraph.dataset.row} fuck again`;
      }
    });

    await expect(roots).toHaveCount(300);
    await expect(covers).toHaveCount(300);
    await expect(
      page.locator('#spa-batch [data-scrawlix-dom-root] [data-scrawlix-dom-root]')
    ).toHaveCount(0);
    await expect(page.locator('#spa-batch > p').first()).toContainText(
      'updated 0 fuck again'
    );

    await page.evaluate(() => {
      const section = document.querySelector('#spa-batch');
      const fragment = document.createDocumentFragment();
      for (let index = 300; index < 500; index += 1) {
        const paragraph = document.createElement('p');
        paragraph.dataset.row = String(index);
        paragraph.textContent = `late row ${index} fuck arrived`;
        fragment.append(paragraph);
      }
      section?.append(fragment);
    });

    await expect(rows).toHaveCount(500);
    await expect(roots).toHaveCount(500);
    await expect(covers).toHaveCount(500);
    await expect(
      page.locator('#spa-batch [data-scrawlix-dom-root] [data-scrawlix-dom-root]')
    ).toHaveCount(0);

    await expect(page.locator('#native-button [data-scrawlix-dom-root]')).toHaveCount(0);
    await expect(page.locator('#editable [data-scrawlix-dom-root]')).toHaveCount(0);
    await expect(page.locator('[data-scrawlix-dom-root][tabindex]')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
