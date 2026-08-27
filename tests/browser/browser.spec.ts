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

test('demo controls drive real rendered coverage and reveal state', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173');

  const proof = page.locator('.proof-output [data-scrawlix-root]');
  const firstCover = proof.locator('[data-scrawlix-cover]').first();

  await expect(proof).toBeVisible();
  await expect(firstCover).toHaveAttribute('data-appearance', 'scrawl');
  await expect(firstCover).toHaveText('uc');

  await page.getByRole('button', { name: 'bar', exact: true }).click();
  await expect(firstCover).toHaveAttribute('data-appearance', 'bar');

  await page.getByRole('button', { name: 'full', exact: true }).click();
  await expect(firstCover).toHaveText('fuck');

  await page.getByRole('button', { name: 'click', exact: true }).click();
  await expect(proof).toHaveAttribute('data-reveal', 'click');
  await expect(proof).toHaveAttribute('data-revealed', 'false');

  await proof.click();
  await expect(proof).toHaveAttribute('data-revealed', 'true');

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('built extension registers granted hosts and handles page interaction in Chromium', async ({}, testInfo) => {
  const testExtensionPath = extensionWithPregrantedHosts(
    testInfo.outputPath('extension-under-test')
  );
  const context = await chromium.launchPersistentContext(
    testInfo.outputPath('extension-profile'),
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
          return scripts[0]?.matches?.sort() ?? [];
        })
      )
      .toEqual(['http://*/*', 'https://*/*']);

    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('http://127.0.0.1:4174/fixture.html');

    const initialRoot = page.locator('#initial [data-scrawlix-dom-root]');
    await expect(initialRoot).toHaveCount(1);
    await expect(
      page.locator('#initial [data-scrawlix-cover]')
    ).toHaveText('uc');

    await expect(page.locator('#code [data-scrawlix-dom-root]')).toHaveCount(0);
    await expect(page.locator('#editable [data-scrawlix-dom-root]')).toHaveCount(0);
    await expect(
      page.locator('#native-button [data-scrawlix-dom-root]')
    ).toHaveCount(0);

    // Links retain their native semantics even when their text is transformed.
    await expect(
      page.locator('#native-link [data-scrawlix-dom-root]')
    ).toHaveCount(1);

    await page.getByRole('button', { name: 'add dynamic' }).click();
    await expect(
      page.locator('#dynamic-copy [data-scrawlix-dom-root]')
    ).toHaveCount(1);
    await expect(
      page.locator('#dynamic-copy [data-scrawlix-cover]')
    ).toHaveText('uc');

    // Temporary reveal changes presentation only. Owned censor DOM stays in place.
    await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: 'http://127.0.0.1:4174/*' });
      const tabId = tabs.find(tab => tab.url?.endsWith('/fixture.html'))?.id;
      if (tabId === undefined) throw new Error('Fixture tab was unavailable.');
      await chrome.tabs.sendMessage(tabId, {
        type: 'scrawlix-reveal-for',
        durationMs: 500,
      });
    });

    await expect(page.locator('html')).toHaveAttribute(
      'data-scrawlix-page-revealed',
      'true'
    );
    await expect(initialRoot).toHaveCount(1);
    await expect
      .poll(() => page.locator('html').getAttribute('data-scrawlix-page-revealed'))
      .toBeNull();
    await expect(initialRoot).toHaveCount(1);

    // Full-tab Options uses the real engine for its specimen and edits the live custom list.
    const optionsUrl = await worker.evaluate(() => chrome.runtime.getURL('options.html'));
    const options = await context.newPage();
    await options.goto(optionsUrl);
    await expect(options.getByRole('heading', { name: 'Custom terms' })).toBeVisible();
    await expect(
      options.locator('#preview-stage [data-scrawlix-cover]')
    ).toHaveText('othb');

    await options.locator('#new-terms').fill('Mothbit');
    await options.getByRole('button', { name: 'add terms', exact: true }).click();
    await expect(options.locator('#term-list')).toContainText('Mothbit');
    await expect(options.locator('#custom-count')).toHaveText('1 term');

    await page.evaluate(() => {
      const paragraph = document.createElement('p');
      paragraph.id = 'custom-term-copy';
      paragraph.textContent = 'Mothbit arrived';
      document.querySelector('main')?.append(paragraph);
    });
    await expect(
      page.locator('#custom-term-copy [data-scrawlix-dom-root]')
    ).toHaveCount(1);
    await expect(
      page.locator('#custom-term-copy [data-scrawlix-cover]')
    ).toHaveText('othb');

    await options.getByRole('button', { name: 'Remove Mothbit' }).click();
    await expect(options.locator('#term-list')).not.toContainText('Mothbit');
    await expect(options.locator('#custom-count')).toHaveText('0 terms');
    await expect(
      page.locator('#custom-term-copy [data-scrawlix-dom-root]')
    ).toHaveCount(0);
    await options.close();

    await page.locator('#native-link').click();
    await expect(page).toHaveURL('http://127.0.0.1:4174/clicked.html');
    await expect(page.locator('#clicked')).toHaveText('native link worked');
  } finally {
    await context.close();
  }
});
