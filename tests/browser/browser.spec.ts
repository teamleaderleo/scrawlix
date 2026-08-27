import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const extensionPath = resolve(process.cwd(), 'apps/extension/dist');

test('demo controls drive real rendered coverage and reveal state', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173');

  const proof = page.locator('.proof-output [data-scrawlix-root]');
  const firstCover = proof.locator('[data-scrawlix-cover]').first();

  await expect(proof).toBeVisible();
  await expect(proof).toHaveAttribute('data-scrawlix-appearance', 'scrawl');
  await expect(firstCover).toHaveText('uc');

  await page.getByRole('button', { name: 'bar', exact: true }).click();
  await expect(proof).toHaveAttribute('data-scrawlix-appearance', 'bar');

  await page.getByRole('button', { name: 'full', exact: true }).click();
  await expect(firstCover).toHaveText('fuck');

  for (const appearance of ['whiteout', 'mosaic', 'asterisk'] as const) {
    await page.getByRole('button', { name: appearance, exact: true }).click();
    await expect(proof).toHaveAttribute('data-scrawlix-appearance', appearance);
  }

  await page.getByRole('button', { name: 'click', exact: true }).click();
  await expect(proof).toHaveAttribute('data-scrawlix-reveal', 'click');
  await expect(proof).toHaveAttribute('data-scrawlix-revealed', 'false');

  const beforeRevealBox = await firstCover.boundingBox();
  await proof.click();
  await expect(proof).toHaveAttribute('data-scrawlix-revealed', 'true');
  const afterRevealBox = await firstCover.boundingBox();

  if (!beforeRevealBox || !afterRevealBox) {
    throw new Error('Expected the first covered segment to have a layout box.');
  }
  expect(Math.abs(beforeRevealBox.width - afterRevealBox.width)).toBeLessThan(0.5);

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

    const initialRoot = page.locator('#initial [data-scrawlix-dom-root]');
    await expect(initialRoot).toHaveCount(1);
    await expect(initialRoot).toHaveAttribute('data-scrawlix-root', '');
    await expect(initialRoot).toHaveAttribute('data-scrawlix-appearance', 'scrawl');
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
