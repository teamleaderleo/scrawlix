import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDir = resolve(process.cwd(), 'test-results/visual-candidates');

async function openDemo(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:4173');
  await page.evaluate(async () => {
    if ('fonts' in document) await document.fonts.ready;
  });
}

test.beforeAll(async () => {
  await mkdir(outputDir, { recursive: true });
});

test('capture curated Scrawlix visual baseline candidates', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await openDemo(page);

  await expect(page.locator('.specimen-section')).toBeVisible();
  await page.locator('.specimen-section').screenshot({
    animations: 'disabled',
    path: resolve(outputDir, 'specimen-middle-desktop.png'),
  });

  const xraySection = page.locator('.xray-section');
  await expect(xraySection).toBeVisible();
  await xraySection.screenshot({
    animations: 'disabled',
    path: resolve(outputDir, 'xray-middle-desktop.png'),
  });

  await page.getByRole('button', { name: 'full', exact: true }).click();
  await expect(page.locator('[data-xray-stage="cover"] .xray-coverage mark')).toHaveText(
    'fuck'
  );
  await xraySection.screenshot({
    animations: 'disabled',
    path: resolve(outputDir, 'xray-full-desktop.png'),
  });

  await page.getByRole('button', { name: 'middle', exact: true }).click();
  await page.getByRole('button', { name: 'focus', exact: true }).click();
  const proof = page.locator('.proof-output [data-scrawlix-root]');
  await proof
    .getByRole('button', { name: /Reveal censored text 1 of/ })
    .focus();
  await expect(proof.locator('[data-scrawlix-focused="true"]')).toHaveCount(1);
  await page.locator('.proof-card').screenshot({
    animations: 'disabled',
    path: resolve(outputDir, 'proof-match-focus.png'),
  });

  await page.getByRole('button', { name: 'click', exact: true }).click();
  const firstCover = proof.locator('[data-scrawlix-cover]').first();
  await firstCover.click();
  await expect(firstCover).toHaveAttribute('data-scrawlix-revealed', 'true');
  await page.locator('.proof-card').screenshot({
    animations: 'disabled',
    path: resolve(outputDir, 'proof-match-click-revealed.png'),
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await openDemo(page);
  await expect(page.locator('.hero')).toBeVisible();
  await page.locator('.hero').screenshot({
    animations: 'disabled',
    path: resolve(outputDir, 'hero-mobile.png'),
  });
});
