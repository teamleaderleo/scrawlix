import { expect, test } from '@playwright/test';
import {
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
    await expect(page.locator('#initial [data-scrawlix-dom-root]')).toHaveCount(1);

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
    await expect(page.locator('#private [data-scrawlix-dom-root]')).toHaveCount(1);

    await Promise.all([
      popup.locator('#appearance').selectOption('blur'),
      options.locator('#coverage').selectOption('full'),
    ]);
    await expect(page.locator('#initial [data-scrawlix-dom-root]')).toHaveAttribute(
      'data-scrawlix-appearance',
      'blur'
    );
    await expect(page.locator('#initial [data-scrawlix-cover]')).toHaveText('fuck');
    await expect(page.locator('#private [data-scrawlix-cover]')).toHaveText('Mothbit');

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
    await expect(page.locator('#initial [data-scrawlix-dom-root]')).toHaveCount(0);
    await expect(page.locator('#initial')).toHaveText('well, fuck this');

    await options.locator('#active').check();
    const restoredRoot = page.locator('#initial [data-scrawlix-dom-root]');
    await expect(restoredRoot).toHaveCount(1);
    await expect(restoredRoot).toHaveAttribute('data-scrawlix-reveal', 'never');
    await expect(restoredRoot).toHaveAttribute('data-scrawlix-appearance', 'blur');
    await expect(restoredRoot.locator('[data-scrawlix-cover]')).toHaveText('fuck');

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
      runAt: 'document_idle',
      persistAcrossSessions: true,
      allFrames: false,
      matchOriginAsFallback: false,
    });

    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('http://127.0.0.1:4174/fixture.html');
    const initialRoot = page.locator('#initial [data-scrawlix-dom-root]');
    await expect(initialRoot).toHaveCount(1);
    await expect(initialRoot).toHaveAttribute('data-scrawlix-appearance', 'blur');
    await expect(initialRoot).toHaveAttribute('data-scrawlix-reveal', 'never');
    await expect(initialRoot.locator('[data-scrawlix-cover]')).toHaveText('fuck');
    await expect(page.locator('#private [data-scrawlix-cover]')).toHaveText('Mothbit');

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
