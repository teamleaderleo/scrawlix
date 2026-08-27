import { expect, test } from '@playwright/test';

test('demo controls context lab survives hostile inline hosts', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173');

  const lab = page.locator('.context-lab-section');
  const cases = lab.locator('[data-context-case]');
  const roots = lab.locator('[data-scrawlix-root]');

  await expect(lab).toBeVisible();
  await expect(cases).toHaveCount(8);
  await expect(roots.first()).toHaveAttribute('data-scrawlix-appearance', 'scrawl');
  await expect(roots.first()).toHaveAttribute('data-scrawlix-reveal', 'never');

  const darkRoot = lab.locator('[data-context-case="dark"] [data-scrawlix-root]');
  expect(
    await darkRoot.evaluate(element =>
      getComputedStyle(element).getPropertyValue('--scrawlix-surface').trim()
    )
  ).toBe('#171512');

  const rtl = lab.locator('[data-context-case="rtl"] .context-rtl');
  const rtlRoot = rtl.locator('[data-scrawlix-root]');
  await expect(rtl).toHaveAttribute('dir', 'rtl');
  await expect(rtlRoot.locator('[data-scrawlix-a11y]')).toHaveText(
    'هذا shit يحدث'
  );
  await expect(rtlRoot.locator('[data-scrawlix-cover]')).toHaveText('hi');

  const emoji = lab.locator('[data-context-case="emoji"]');
  await expect(emoji.locator('[data-scrawlix-cover]')).toHaveText(['uc', 'hi']);

  const link = lab.locator('[data-context-case="link"] a');
  await link.click();
  await expect(page).toHaveURL(/#context-title$/);

  await page.getByRole('button', { name: 'mosaic', exact: true }).click();
  await page.getByRole('button', { name: 'full', exact: true }).click();
  await expect(roots.first()).toHaveAttribute('data-scrawlix-appearance', 'mosaic');
  await expect(
    lab.locator('[data-context-case="serif-italic"] [data-scrawlix-cover]')
  ).toHaveText('fuck');
  await expect(lab.locator('.context-heading')).toContainText('full coverage');

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await lab.evaluate(
    element => element.scrollWidth - element.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
