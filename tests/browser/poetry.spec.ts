import { expect, test } from '@playwright/test';

test('demo controls include reversible redaction poetry', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173');

  const poem = page.locator('[data-redaction-poetry]');
  const visible = poem.locator('[data-redaction-visible]');
  const covered = poem.locator('[data-redaction-covered]');
  const visual = poem.locator('[data-redaction-visual]');
  const source = poem.locator('[data-redaction-a11y]');

  await expect(poem).toBeVisible();
  await expect(poem).toHaveAttribute('data-redaction-revealed', 'false');
  await expect(visible).toHaveCount(5);
  expect(await visible.allTextContents()).toEqual([
    'desire',
    'fell',
    'through',
    'heaven',
    'Tuesday',
  ]);
  await expect.poll(() => covered.count()).toBeGreaterThan(0);

  const originalSource = await source.textContent();
  expect(originalSource).toBeTruthy();
  await expect(visual).toHaveText(originalSource!);

  const coveredStyle = await covered.first().evaluate(element => {
    const style = getComputedStyle(element);
    return { color: style.color, backgroundImage: style.backgroundImage };
  });
  expect(coveredStyle.color).toBe('rgba(0, 0, 0, 0)');
  expect(coveredStyle.backgroundImage).not.toBe('none');

  await poem.getByRole('button', { name: 'restore source' }).click();
  await expect(poem).toHaveAttribute('data-redaction-revealed', 'true');
  await expect(visual).toHaveText(originalSource!);

  const restoredStyle = await covered.first().evaluate(element => {
    const style = getComputedStyle(element);
    return { color: style.color, backgroundImage: style.backgroundImage };
  });
  expect(restoredStyle.color).not.toBe('rgba(0, 0, 0, 0)');
  expect(restoredStyle.backgroundImage).toBe('none');

  await page.locator('.poetry-controls textarea').nth(1).fill('desire\nTuesday');
  await expect(visible).toHaveCount(2);
  expect(await visible.allTextContents()).toEqual(['desire', 'Tuesday']);

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
