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

test('built extension popup preferences persist across reopen and drive the page', async ({}, testInfo) => {
  const testExtensionPath = extensionWithPregrantedHosts(
    testInfo.outputPath('popup-extension-under-test')
  );
  const context = await chromium.launchPersistentContext(
    testInfo.outputPath('popup-extension-profile'),
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

    const target = context.pages()[0] ?? (await context.newPage());
    await target.goto('http://127.0.0.1:4174/fixture.html');
    const targetRoot = target.locator('#initial [data-scrawlix-dom-root]');
    await expect(targetRoot).toHaveCount(1);

    const popupUrl = await worker.evaluate(() => chrome.runtime.getURL('popup.html'));
    const popup = await context.newPage();
    await popup.goto(popupUrl);

    await expect(popup.locator('#active')).toBeChecked();
    await expect(popup.locator('#appearance')).toHaveValue('scrawl');
    await expect(popup.locator('#coverage')).toHaveValue('middle');
    await expect(popup.locator('#reveal')).toHaveValue('hover');
    await expect(popup.locator('#default-enabled')).toBeHidden();

    await popup.locator('#appearance').selectOption('bar');
    await popup.locator('#coverage').selectOption('full');
    await popup.locator('#reveal').selectOption('never');
    await expect(popup.locator('#settings-status')).toHaveText('saved');

    await expect(targetRoot).toHaveAttribute('data-scrawlix-appearance', 'bar');
    await expect(targetRoot).toHaveAttribute('data-scrawlix-reveal', 'never');
    await expect(target.locator('#initial [data-scrawlix-cover]')).toHaveText('fuck');

    // Master pause from the popup restores source on the already-open page.
    await popup.locator('#active').uncheck();
    await expect(popup.locator('#settings-status')).toHaveText('saved');
    await expect(targetRoot).toHaveCount(0);
    await expect(target.locator('#initial')).toHaveText('well, fuck this');
    await popup.close();

    // Reopening the popup reads the persisted values rather than falling back to defaults.
    const reopened = await context.newPage();
    await reopened.goto(popupUrl);
    await expect(reopened.locator('#active')).not.toBeChecked();
    await expect(reopened.locator('#appearance')).toHaveValue('bar');
    await expect(reopened.locator('#coverage')).toHaveValue('full');
    await expect(reopened.locator('#reveal')).toHaveValue('never');
    await expect(reopened.locator('#default-enabled')).toBeHidden();

    await reopened.locator('#active').check();
    await expect(reopened.locator('#settings-status')).toHaveText('saved');
    await expect(targetRoot).toHaveCount(1);
    await expect(targetRoot).toHaveAttribute('data-scrawlix-appearance', 'bar');
    await expect(targetRoot).toHaveAttribute('data-scrawlix-reveal', 'never');
    await expect(target.locator('#initial [data-scrawlix-cover]')).toHaveText('fuck');
  } finally {
    await context.close();
  }
});
