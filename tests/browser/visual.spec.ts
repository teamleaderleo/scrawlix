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

  const specimenSection = page.locator('.specimen-section');
  await expect(specimenSection).toBeVisible();
  await expect(specimenSection).toHaveScreenshot('specimen-middle-desktop.png', {
    animations: 'disabled',
  });

  const contextLab = page.locator('.context-lab-section');
  await expect(contextLab).toBeVisible();
  await pinToWholeCssPixels(contextLab);
  await expect(contextLab).toHaveScreenshot('context-lab-desktop.png', {
    animations: 'disabled',
  });

  const xraySection = page.locator('.xray-section');
  await expect(xraySection).toBeVisible();
  await pinToWholeCssPixels(xraySection);
  await expect(xraySection).toHaveScreenshot('xray-middle-desktop.png', {
    animations: 'disabled',
  });

  await page.getByRole('button', { name: 'full', exact: true }).click();
  await expect(page.locator('[data-xray-stage="cover"] .xray-coverage mark')).toHaveText(
    'fuck'
  );
  await expect(xraySection).toHaveScreenshot('xray-full-desktop.png', {
    animations: 'disabled',
  });

  await page.getByRole('button', { name: 'middle', exact: true }).click();
  await page.getByRole('button', { name: 'focus', exact: true }).click();
  const proof = page.locator('.proof-output [data-scrawlix-root]');
  await proof
    .getByRole('button', { name: /Reveal censored text 1 of/ })
    .focus();
  await expect(proof.locator('[data-scrawlix-focused="true"]')).toHaveCount(1);
  await expect(page.locator('.proof-card')).toHaveScreenshot('proof-match-focus.png', {
    animations: 'disabled',
  });

  await page.getByRole('button', { name: 'click', exact: true }).click();
  const firstCover = proof.locator('[data-scrawlix-cover]').first();
  await firstCover.click();
  await expect(firstCover).toHaveAttribute('data-scrawlix-revealed', 'true');
  await expect(page.locator('.proof-card')).toHaveScreenshot(
    'proof-match-click-revealed.png',
    { animations: 'disabled' }
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await openDemo(page);
  const hero = page.locator('.hero');
  await expect(hero).toBeVisible();
  await expect(hero).toHaveScreenshot('hero-mobile.png', {
    animations: 'disabled',
  });
});
