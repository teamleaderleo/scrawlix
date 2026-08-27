import { chromium, expect, test } from '@playwright/test';
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const extensionPath = resolve(process.cwd(), 'apps/extension/dist');

function extensionWithPregrantedHosts(outputPath: string) {
  cpSync(extensionPath, outputPath, { recursive: true });

  const manifestPath = resolve(outputPath, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.host_permissions = manifest.optional_host_permissions ?? [];
  delete manifest.optional_host_permissions;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return outputPath;
}

test('built extension stays idempotent across dense SPA mutation batches', async ({}, testInfo) => {
  const testExtensionPath = extensionWithPregrantedHosts(
    testInfo.outputPath('spa-extension-under-test')
  );
  const context = await chromium.launchPersistentContext(
    testInfo.outputPath('spa-extension-profile'),
    {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${testExtensionPath}`,
        `--load-extension=${testExtensionPath}`,
      ],
    }
  );

  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await expect
      .poll(async () =>
        worker.evaluate(async () => {
          const scripts = await chrome.scripting.getRegisteredContentScripts({
            ids: ['scrawlix-page'],
          });
          return scripts[0]?.runAt ?? null;
        })
      )
      .toBe('document_start');

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

    // A virtualized/feed-style app commonly replaces text inside existing row containers.
    // Scrawlix should restore one generated root per row instead of nesting or duplicating.
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
    await expect(page.locator('#spa-batch > p').first()).toContainText('updated 0 fuck again');

    // Add another large document fragment in one mutation turn, similar to an infinite-feed page.
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

    // Page interaction exclusions stay intact while the heavy batch observer is active.
    await expect(page.locator('#native-button [data-scrawlix-dom-root]')).toHaveCount(0);
    await expect(page.locator('#editable [data-scrawlix-dom-root]')).toHaveCount(0);
    await expect(page.locator('[data-scrawlix-dom-root][tabindex]')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
