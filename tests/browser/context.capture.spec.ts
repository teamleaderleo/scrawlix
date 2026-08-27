import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDir = resolve(process.cwd(), 'test-results/context-candidate');

test.beforeAll(async () => {
  await mkdir(outputDir, { recursive: true });
});

test('capture context lab visual candidate', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:4173');
  await page.evaluate(async () => {
    if ('fonts' in document) await document.fonts.ready;
  });

  const lab = page.locator('.context-lab-section');
  await expect(lab).toBeVisible();
  await lab.screenshot({
    animations: 'disabled',
    path: resolve(outputDir, 'context-lab-desktop.png'),
  });
});
