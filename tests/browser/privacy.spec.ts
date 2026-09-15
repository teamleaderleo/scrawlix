import { expect, test } from '@playwright/test';

const sourceText = 'Project Velvet ships Friday to Acme Widgets.';

test('demo controls distinguish reversible covers from sanitized output', async ({
  context,
  page,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://127.0.0.1:4173',
  });
  await page.goto('http://127.0.0.1:4173');

  const lab = page.locator('[data-privacy-lab]');
  const pixels = lab.locator('[data-privacy-pixels]');
  const root = pixels.locator('[data-scrawlix-root]');
  const covers = pixels.locator('[data-scrawlix-cover]');
  const sanitized = lab.locator('[data-sanitized-output]');
  const copyButton = lab.getByRole('button', { name: 'Copy sanitized text' });

  await expect(lab).toBeVisible();
  await expect(root).toHaveAttribute('data-reveal', 'never');
  await expect(covers).toHaveCount(2);
  expect(await covers.allTextContents()).toEqual([
    'Project Velvet',
    'Acme Widgets',
  ]);

  await expect(root.locator('[data-scrawlix-a11y]')).toHaveText(sourceText);
  await expect(lab.locator('[data-privacy-a11y]')).toHaveText(sourceText);
  await expect(lab.locator('[data-privacy-dom]')).toHaveText(sourceText);

  await expect(sanitized).toHaveText(
    '[REDACTED] ships Friday to [REDACTED].'
  );
  expect(await sanitized.textContent()).not.toContain('Project Velvet');
  expect(await sanitized.textContent()).not.toContain('Acme Widgets');
  await expect(lab.locator('[data-sanitized-guarantee]')).toContainText(
    'Selected source absent from this generated string.'
  );
  await expect(copyButton).toBeEnabled();

  await copyButton.click();
  await expect(lab.locator('[data-sanitized-copy-status]')).toHaveText(
    'Sanitized string copied.'
  );

  await page.evaluate(() => {
    const textarea = document.createElement('textarea');
    textarea.dataset.sanitizedPasteProof = '';
    document.body.append(textarea);
  });
  const pasted = page.locator('textarea[data-sanitized-paste-proof]');
  await pasted.focus();
  await page.keyboard.press('Control+V');
  await expect(pasted).toHaveValue(
    '[REDACTED] ships Friday to [REDACTED].'
  );
  const pastedValue = await pasted.inputValue();
  expect(pastedValue).not.toContain('Project Velvet');
  expect(pastedValue).not.toContain('Acme Widgets');

  await lab.getByLabel('Sanitized export replacement').fill('████');
  await expect(sanitized).toHaveText('████ ships Friday to ████.');
  expect(await sanitized.textContent()).not.toContain('Project Velvet');
  expect(await sanitized.textContent()).not.toContain('Acme Widgets');
  await expect(copyButton).toBeEnabled();

  await lab
    .getByLabel('Sanitized export replacement')
    .fill('Project Velvet');
  await expect(copyButton).toBeDisabled();
  await expect(lab.locator('[data-sanitized-guarantee]')).toHaveText(
    'Source-absence verification failed for this generated string.'
  );

  await lab.getByLabel('Sanitized export replacement').fill('████');
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
