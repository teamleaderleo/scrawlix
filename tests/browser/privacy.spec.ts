import { expect, test } from '@playwright/test';

const sourceText = 'Project Velvet ships Friday to Acme Widgets.';

test('demo controls distinguish reversible covers from sanitized output', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173');

  const lab = page.locator('[data-privacy-lab]');
  const pixels = lab.locator('[data-privacy-pixels]');
  const root = pixels.locator('[data-scrawlix-root]');
  const covers = pixels.locator('[data-scrawlix-cover]');
  const sanitized = lab.locator('[data-sanitized-output]');

  await expect(lab).toBeVisible();
  await expect(root).toHaveAttribute('data-reveal', 'never');
  await expect(covers).toHaveCount(2);
  expect(await covers.allTextContents()).toEqual(['Project Velvet', 'Acme Widgets']);

  await expect(root.locator('[data-scrawlix-a11y]')).toHaveText(sourceText);
  await expect(lab.locator('[data-privacy-a11y]')).toHaveText(sourceText);
  await expect(lab.locator('[data-privacy-dom]')).toHaveText(sourceText);

  await expect(sanitized).toHaveText('[REDACTED] ships Friday to [REDACTED].');
  expect(await sanitized.textContent()).not.toContain('Project Velvet');
  expect(await sanitized.textContent()).not.toContain('Acme Widgets');

  await lab.getByLabel('Sanitized export replacement').fill('████');
  await expect(sanitized).toHaveText('████ ships Friday to ████.');
  expect(await sanitized.textContent()).not.toContain('Project Velvet');
  expect(await sanitized.textContent()).not.toContain('Acme Widgets');

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
