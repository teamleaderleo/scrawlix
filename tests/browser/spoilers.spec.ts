import { expect, test } from '@playwright/test';

test('demo controls activate spoiler rules from viewing progress', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173');

  const lab = page.locator('[data-spoiler-lab]');
  const output = lab.locator('.spoiler-output');
  const root = output.locator('[data-scrawlix-root]');
  const covers = output.locator('[data-scrawlix-cover]');

  await expect(lab).toBeVisible();
  await expect(lab).toHaveAttribute('data-watched-through', '2');
  await expect(lab).toHaveAttribute('data-hidden-count', '3');
  await expect(covers).toHaveCount(3);
  expect(await covers.allTextContents()).toEqual([
    "the Ferryman is Mara's brother",
    'the red key opens the observatory',
    'Mara burns the north archive',
  ]);
  await expect(root).toHaveAttribute('data-reveal', 'click');
  await expect(root).toHaveAttribute('data-revealed', 'false');

  await root.click();
  await expect(root).toHaveAttribute('data-revealed', 'true');

  await lab.getByRole('button', { name: '4', exact: true }).click();
  await expect(lab).toHaveAttribute('data-watched-through', '4');
  await expect(lab).toHaveAttribute('data-hidden-count', '1');
  await expect(covers).toHaveCount(1);
  await expect(covers).toHaveText('Mara burns the north archive');
  await expect(root).toHaveAttribute('data-revealed', 'false');

  await lab.getByRole('button', { name: '5', exact: true }).click();
  await expect(lab).toHaveAttribute('data-watched-through', '5');
  await expect(lab).toHaveAttribute('data-hidden-count', '0');
  await expect(output.locator('[data-scrawlix-root]')).toHaveCount(0);
  await expect(output).toContainText('Mara burns the north archive');

  await lab.getByRole('button', { name: '1', exact: true }).click();
  await expect(lab).toHaveAttribute('data-hidden-count', '4');
  await expect(output.locator('[data-scrawlix-cover]')).toHaveCount(4);

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
