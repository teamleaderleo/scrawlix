import { chromium, expect, test, type BrowserContext } from '@playwright/test';
import { resolve } from 'node:path';

const extensionPath = resolve(process.cwd(), 'apps/extension/dist');

async function loadedExtensionId(context: BrowserContext) {
  const extensionsPage = await context.newPage();
  await extensionsPage.goto('chrome://extensions/');
  const items = extensionsPage.locator('extensions-item');
  await expect.poll(() => items.count()).toBeGreaterThan(0);

  const extensionId = await items.evaluateAll(elements => {
    for (const element of elements) {
      const item = element as HTMLElement & {
        data?: { id?: string; name?: string };
      };
      const text = item.shadowRoot?.textContent ?? '';
      if (item.data?.name === 'Scrawlix' || text.toLowerCase().includes('scrawlix')) {
        return item.id || item.data?.id || '';
      }
    }
    return '';
  });

  await extensionsPage.close();
  if (!extensionId) throw new Error('Could not resolve the unpacked Scrawlix extension id.');
  return extensionId;
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
  const context = await chromium.launchPersistentContext(
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

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('http://127.0.0.1:4174/fixture.html');

    await expect(
      page.locator('#initial [data-scrawlix-dom-root]')
    ).toHaveCount(1);
    await expect(
      page.locator('#initial [data-scrawlix-cover]')
    ).toHaveText('uc');
    await expect(page.locator('#private [data-scrawlix-dom-root]')).toHaveCount(0);

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

test('built extension switches lens profiles and restores the live page', async ({}, testInfo) => {
  const context = await chromium.launchPersistentContext(
    testInfo.outputPath('extension-lens-profiles'),
    {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    }
  );

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('http://127.0.0.1:4174/fixture.html');
    await expect(page.locator('#initial [data-scrawlix-dom-root]')).toHaveCount(1);
    await expect(page.locator('#private [data-scrawlix-dom-root]')).toHaveCount(0);

    const extensionId = await loadedExtensionId(context);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.getByLabel('Active profile')).toHaveValue('profile:everyday');

    await popup.getByRole('button', { name: '+ lens' }).click();
    let customLenses = popup.locator('.lens-card[data-lens-kind="terms"]');
    await expect(customLenses).toHaveCount(1);
    await customLenses.last().locator('.lens-name').fill('Private');
    await customLenses.last().locator('textarea').fill('Mothbit');
    await expect(popup.locator('#local-save-status')).toHaveText('saved');
    await expect(page.locator('#private [data-scrawlix-dom-root]')).toHaveCount(1);

    await popup.getByRole('button', { name: '+ lens' }).click();
    customLenses = popup.locator('.lens-card[data-lens-kind="terms"]');
    await expect(customLenses).toHaveCount(2);
    await customLenses.last().locator('.lens-name').fill('Spoilers');
    await customLenses.last().locator('textarea').fill('Rosebud');
    await expect(popup.locator('#local-save-status')).toHaveText('saved');

    await popup.getByRole('button', { name: 'new', exact: true }).click();
    await popup.getByLabel('profile name').fill('Presentation');
    await popup.getByLabel('appearance').selectOption('bar');
    await popup.getByLabel('coverage').selectOption('full');
    await popup.getByLabel('reveal').selectOption('never');

    const profanityCard = popup.locator(
      '.lens-card[data-lens-kind="english-profanity"]'
    );
    await profanityCard.locator('input[type="checkbox"]').uncheck();
    await expect(popup.locator('#local-save-status')).toHaveText('saved');

    await expect(page.locator('#initial [data-scrawlix-dom-root]')).toHaveCount(0);
    await expect(page.locator('#initial')).toHaveText('well, fuck this');

    const privateRoot = page.locator('#private [data-scrawlix-dom-root]');
    await expect(privateRoot).toHaveCount(1);
    await expect(privateRoot).toHaveAttribute('data-scrawlix-appearance', 'bar');
    await expect(privateRoot).toHaveAttribute('data-scrawlix-reveal', 'never');
    await expect(privateRoot.locator('[data-scrawlix-cover]')).toHaveText('Mothbit');

    await popup.getByLabel('Active profile').selectOption({ label: 'Everyday' });
    await expect(page.locator('#initial [data-scrawlix-dom-root]')).toHaveCount(1);
    await expect(page.locator('#private [data-scrawlix-dom-root]')).toHaveCount(1);
    await expect(page.locator('#private [data-scrawlix-dom-root]')).toHaveAttribute(
      'data-scrawlix-appearance',
      'scrawl'
    );

    await popup.close();
  } finally {
    await context.close();
  }
});
