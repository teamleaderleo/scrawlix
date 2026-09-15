import { expect, test } from '@playwright/test';
import {
  extensionHighlightRanges,
  extensionWithPregrantedHosts,
  launchExtensionContext,
  loadedExtensionId,
  registeredContentScript,
  serviceWorker,
} from './extension-harness';

test('built extension preserves popup and Options intent across browser restart', async ({}, testInfo) => {
  const testExtensionPath = await extensionWithPregrantedHosts(
    testInfo.outputPath('persistent-extension')
  );
  const profilePath = testInfo.outputPath('persistent-profile');
  let context = await launchExtensionContext(profilePath, testExtensionPath);

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('http://127.0.0.1:4174/fixture.html');
    const fixtureUrl = page.url();
    await expect
      .poll(async () =>
        (await extensionHighlightRanges(context, fixtureUrl)).some(
          range => range.parentId === 'initial'
        )
      )
      .toBe(true);
    await expect(page.locator('[data-scrawlix-dom-root]')).toHaveCount(0);

    const extensionId = await loadedExtensionId(context);
    const popup = await context.newPage();
    const options = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await options.goto(`chrome-extension://${extensionId}/options.html`);

    await expect(popup.locator('#profile')).toHaveValue('profile:everyday');
    await expect(options.locator('#profile')).toHaveValue('profile:everyday');
    await expect(popup.locator('footer')).toContainText('v0.0.0');
    await expect(options.locator('#compatibility')).toContainText('Chrome 119+');

    await options.getByRole('button', { name: '+ custom lens' }).click();
    let customLenses = options.locator('.lens-card[data-lens-kind="terms"]');
    await expect(customLenses).toHaveCount(1);
    let customLens = customLenses.last();
    await customLens.locator('.lens-name').fill('Private');
    await customLens.locator('.lens-name').press('Tab');
    await expect(options.locator('#settings-status')).toHaveText('saved');

    customLenses = options.locator('.lens-card[data-lens-kind="terms"]');
    customLens = customLenses.last();
    await customLens.locator('.lens-term-input').fill('Mothbit\nRosebud');
    await customLens.getByRole('button', { name: 'add terms' }).click();
    await expect(options.locator('#settings-status')).toHaveText('added 2');
    customLens = options.locator('.lens-card[data-lens-kind="terms"]').last();
    await expect(customLens.locator('.term-chip')).toHaveCount(2);
    await expect
      .poll(async () =>
        (await extensionHighlightRanges(context, fixtureUrl)).some(
          range => range.parentId === 'private'
        )
      )
      .toBe(true);

    await Promise.all([
      popup.locator('#appearance').selectOption('blur'),
      options.locator('#coverage').selectOption('full'),
    ]);
    await expect
      .poll(async () => {
        const ranges = await extensionHighlightRanges(context, fixtureUrl);
        return {
          initial: ranges.find(range => range.parentId === 'initial')?.text ?? null,
          private: ranges.find(range => range.parentId === 'private')?.text ?? null,
        };
      })
      .toEqual({ initial: 'fuck', private: 'Mothbit' });
    await expect(page.locator('#initial')).toHaveText('well, fuck this');
    await expect(page.locator('#private')).toHaveText('Mothbit remains private');

    const worker = await serviceWorker(context);
    await worker.evaluate(async () => {
      await chrome.storage.local.set({
        scrawlixSiteOverrides: { '127.0.0.1': 'on' },
      });
    });
    await expect(options.locator('#site-list .managed-row')).toHaveCount(1);

    await Promise.all([
      options.locator('#active').uncheck(),
      popup.locator('#reveal').selectOption('never'),
    ]);
    await expect.poll(() => extensionHighlightRanges(context, fixtureUrl)).toEqual([]);
    await expect(page.locator('#initial')).toHaveText('well, fuck this');

    await options.locator('#active').check();
    await expect
      .poll(async () => {
        const ranges = await extensionHighlightRanges(context, fixtureUrl);
        return {
          initial: ranges.find(range => range.parentId === 'initial')?.text ?? null,
          private: ranges.find(range => range.parentId === 'private')?.text ?? null,
        };
      })
      .toEqual({ initial: 'fuck', private: 'Mothbit' });
    await expect(page.locator('[data-scrawlix-dom-root]')).toHaveCount(0);

    await options.getByRole('button', { name: 'use default' }).click();
    await expect(options.locator('#site-list .managed-row')).toHaveCount(0);

    await popup.close();
    await options.close();
  } finally {
    await context.close();
  }

  context = await launchExtensionContext(profilePath, testExtensionPath);
  try {
    await expect.poll(() => registeredContentScript(context)).toEqual({
      matches: ['http://*/*', 'https://*/*'],
      js: ['content.js'],
      css: [],
      runAt: 'document_start',
      persistAcrossSessions: true,
      allFrames: false,
      matchOriginAsFallback: false,
    });

    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('http://127.0.0.1:4174/fixture.html');
    const fixtureUrl = page.url();
    await expect
      .poll(async () => {
        const ranges = await extensionHighlightRanges(context, fixtureUrl);
        return {
          initial: ranges.find(range => range.parentId === 'initial')?.text ?? null,
          private: ranges.find(range => range.parentId === 'private')?.text ?? null,
        };
      })
      .toEqual({ initial: 'fuck', private: 'Mothbit' });
    await expect(page.locator('[data-scrawlix-dom-root]')).toHaveCount(0);

    const extensionId = await loadedExtensionId(context);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.locator('#appearance')).toHaveValue('blur');
    await expect(popup.locator('#coverage')).toHaveValue('full');
    await expect(popup.locator('#reveal')).toHaveValue('never');
    await expect(popup.locator('#custom-count')).toHaveText('2');
  } finally {
    await context.close();
  }
});
