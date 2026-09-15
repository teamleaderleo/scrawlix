import { expect, test, type Locator, type Page } from '@playwright/test';

async function openDemo(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:4173');
  await page.evaluate(async () => {
    if ('fonts' in document) await document.fonts.ready;
  });
}

async function pinToWholeCssPixels(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate(element => {
    const node = element as HTMLElement;
    const rect = node.getBoundingClientRect();
    const x = Math.round(rect.left) - rect.left;
    const y = Math.round(rect.top) - rect.top;
    node.style.translate = `${x}px ${y}px`;
  });
}

test('curated Scrawlix visual regressions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await openDemo(page);

  const specimen = page.locator('.specimen-section');
  await expect(specimen).toBeVisible();
  await expect(specimen).toHaveScreenshot('specimen-middle-desktop.png', {
    animations: 'disabled',
  });

  const contextLab = page.locator('.context-lab-section');
  await expect(contextLab).toBeVisible();
  await pinToWholeCssPixels(contextLab);
  await expect(contextLab).toHaveScreenshot('context-lab-desktop.png', {
    animations: 'disabled',
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await openDemo(page);
  const hero = page.locator('.hero');
  await expect(hero).toBeVisible();
  await expect(hero).toHaveScreenshot('hero-mobile.png', {
    animations: 'disabled',
  });
});
