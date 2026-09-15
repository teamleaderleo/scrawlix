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

test('demo controls drive match-local reveal, stable masks, x-ray, and hostile contexts', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173');

  const proof = page.locator('.proof-output [data-scrawlix-root]');
  const firstCover = proof.locator('[data-scrawlix-cover]').first();
  const secondCover = proof.locator('[data-scrawlix-cover]').nth(1);

  await expect(proof).toBeVisible();
  await expect(proof).toHaveAttribute('data-scrawlix-appearance', 'scrawl');
  await expect(proof).toHaveAttribute('data-scrawlix-reveal-scope', 'match');
  await expect(firstCover).toHaveText('uc');
  await expect(firstCover).toHaveAttribute('data-scrawlix-matches', 'm0');
  await expect(firstCover).toHaveAttribute('data-scrawlix-start', /\d+/);
  await expect(firstCover).toHaveAttribute('data-scrawlix-end', /\d+/);

  await page.getByRole('button', { name: 'asterisk', exact: true }).click();
  await expect(proof).toHaveAttribute('data-scrawlix-appearance', 'asterisk');
  await expect(firstCover).toHaveAttribute('data-scrawlix-mask', '**');

  await page.getByRole('button', { name: 'full', exact: true }).click();
  await expect(firstCover).toHaveText('fuck');
  await expect(firstCover).toHaveAttribute('data-scrawlix-mask', '****');

  await page.getByRole('button', { name: 'click', exact: true }).click();
  await expect(proof).toHaveAttribute('data-scrawlix-reveal', 'click');
  await expect(firstCover).toHaveAttribute('data-scrawlix-revealed', 'false');
  await expect(secondCover).toHaveAttribute('data-scrawlix-revealed', 'false');

  const concealedWidth = await firstCover.evaluate(element =>
    element.getBoundingClientRect().width
  );
  await firstCover.click();
  await expect(firstCover).toHaveAttribute('data-scrawlix-revealed', 'true');
  await expect(secondCover).toHaveAttribute('data-scrawlix-revealed', 'false');
  const revealedWidth = await firstCover.evaluate(element =>
    element.getBoundingClientRect().width
  );
  expect(Math.abs(revealedWidth - concealedWidth)).toBeLessThan(0.01);

  const firstControl = proof.locator('[data-scrawlix-control]').first();
  await expect(firstControl).toHaveAttribute('aria-pressed', 'true');
  await firstControl.focus();
  await firstControl.press('Escape');
  await expect(firstCover).toHaveAttribute('data-scrawlix-revealed', 'false');
  await expect(firstControl).toHaveAttribute('aria-pressed', 'false');

  const xray = page.locator('[data-xray-lab]');
  await expect(xray.locator('[data-xray-stage]')).toHaveCount(4);
  await expect(xray.locator('[data-xray-stage="match"]')).toContainText('motherfucker');
  await expect(xray.locator('[data-xray-stage="target"]')).toContainText('fuck');
  await expect(xray.locator('[data-xray-stage="cover"]')).toContainText('full');
  await expect(xray.locator('[data-xray-stage="output"] [data-scrawlix-root]')).toHaveAttribute(
    'data-scrawlix-appearance',
    'asterisk'
  );

  const contextLab = page.locator('[data-context-lab]');
  await expect(contextLab.locator('[data-context-case]')).toHaveCount(8);

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
    const profilePicker = popup.locator('#profile');
    await expect(profilePicker).toHaveValue('profile:everyday');

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

    await profilePicker.selectOption({ label: 'Everyday' });
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
