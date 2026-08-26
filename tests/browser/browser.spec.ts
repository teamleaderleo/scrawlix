import { chromium, expect, test, type BrowserContext, type TestInfo } from '@playwright/test';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

const extensionPath = resolve(process.cwd(), 'apps/extension/dist');

function unpackedExtensionId(path: string) {
  let normalized = realpathSync(path);
  let bytes: Buffer;

  if (process.platform === 'win32') {
    if (/^[a-z]:/.test(normalized)) {
      normalized = `${normalized[0]!.toUpperCase()}${normalized.slice(1)}`;
    }
    bytes = Buffer.from(normalized, 'utf16le');
  } else {
    bytes = Buffer.from(normalized, 'utf8');
  }

  const hex = createHash('sha256').update(bytes).digest('hex').slice(0, 32);
  return Array.from(hex, digit =>
    String.fromCharCode('a'.charCodeAt(0) + Number.parseInt(digit, 16))
  ).join('');
}

async function launchExtensionContext(testInfo: TestInfo) {
  return chromium.launchPersistentContext(
    testInfo.outputPath('extension-profile'),
    {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    }
  );
}

async function openFixture(context: BrowserContext) {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto('http://127.0.0.1:4174/fixture.html');
  return page;
}

async function openPopup(context: BrowserContext) {
  const popup = await context.newPage();
  const extensionId = unpackedExtensionId(extensionPath);
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator('#enabled')).toBeVisible();
  return popup;
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

test('built extension transforms initial and dynamic page text in Chromium', async ({}, testInfo) => {
  const context = await launchExtensionContext(testInfo);

  try {
    const page = await openFixture(context);

    await expect(
      page.locator('#initial [data-scrawlix-dom-root]')
    ).toHaveCount(1);
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

    await page.locator('#native-link').click();
    await expect(page).toHaveURL('http://127.0.0.1:4174/clicked.html');
    await expect(page.locator('#clicked')).toHaveText('native link worked');
  } finally {
    await context.close();
  }
});

test('built extension restores, persists, overrides sites, and recompiles custom words', async ({}, testInfo) => {
  const context = await launchExtensionContext(testInfo);

  try {
    const page = await openFixture(context);
    const initial = page.locator('#initial');
    const custom = page.locator('#custom-copy');

    await expect(initial.locator('[data-scrawlix-dom-root]')).toHaveCount(1);
    await expect(custom.locator('[data-scrawlix-dom-root]')).toHaveCount(0);

    const popup = await openPopup(context);
    await expect(popup.locator('#enabled')).toBeChecked();

    // Global off goes through the real popup UI and restores source immediately.
    await popup.locator('#enabled').uncheck();
    await expect(initial.locator('[data-scrawlix-dom-root]')).toHaveCount(0);
    await expect(initial).toHaveText('well, fuck this');

    await popup.close();
    const reopened = await openPopup(context);
    await expect(reopened.locator('#enabled')).not.toBeChecked();

    // A persisted per-host override can turn this hostname back on while global is off.
    await reopened.evaluate(async () => {
      const key = 'scrawlixSettings';
      const stored = await chrome.storage.sync.get(key);
      const settings = stored[key];
      await chrome.storage.sync.set({
        [key]: {
          ...settings,
          enabled: false,
          siteOverrides: { '127.0.0.1': 'on' },
        },
      });
    });

    await expect(initial.locator('[data-scrawlix-dom-root]')).toHaveCount(1);

    // Presentation changes also restart through storage and reach the generated roots.
    await reopened.locator('#appearance').selectOption('grawlix');
    await expect(
      initial.locator('[data-scrawlix-dom-root]')
    ).toHaveAttribute('data-scrawlix-appearance', 'grawlix');

    // Custom phrases are saved locally and compiled into the next controller session.
    await reopened.locator('#custom-words').fill('Mothbit');
    await reopened.locator('#custom-words').press('Tab');
    await expect(reopened.locator('#save-status')).toHaveText('saved');
    await expect(custom.locator('[data-scrawlix-dom-root]')).toHaveCount(1);
    await expect(custom.locator('[data-scrawlix-cover]')).toHaveText('othb');

    // Explicit site off wins over global/custom state and restores exact source again.
    await reopened.evaluate(async () => {
      const key = 'scrawlixSettings';
      const stored = await chrome.storage.sync.get(key);
      const settings = stored[key];
      await chrome.storage.sync.set({
        [key]: {
          ...settings,
          siteOverrides: { '127.0.0.1': 'off' },
        },
      });
    });

    await expect(initial.locator('[data-scrawlix-dom-root]')).toHaveCount(0);
    await expect(custom.locator('[data-scrawlix-dom-root]')).toHaveCount(0);
    await expect(initial).toHaveText('well, fuck this');
    await expect(custom).toHaveText(
      'Mothbit stays visible until it joins the custom list.'
    );
  } finally {
    await context.close();
  }
});
