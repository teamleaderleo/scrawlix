import { expect, test } from '@playwright/test';
import {
  extensionWithPregrantedHosts,
  launchExtensionContext,
  loadedExtensionId,
} from './extension-harness';

test('built extension manages lenses and profiles in Options while restoring the live page', async ({}, testInfo) => {
  const testExtensionPath = await extensionWithPregrantedHosts(
    testInfo.outputPath('options-profile-extension')
  );
  const context = await launchExtensionContext(
    testInfo.outputPath('options-profile-browser'),
    testExtensionPath
  );

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('http://127.0.0.1:4174/fixture.html');
    await expect(page.locator('#initial [data-scrawlix-dom-root]')).toHaveCount(1);
    await expect(page.locator('#private [data-scrawlix-dom-root]')).toHaveCount(0);

    const extensionId = await loadedExtensionId(context);
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    const profilePicker = options.locator('#profile');
    await expect(profilePicker).toHaveValue('profile:everyday');

    await options.getByRole('button', { name: '+ custom lens' }).click();
    let customLenses = options.locator('.lens-card[data-lens-kind="terms"]');
    await expect(customLenses).toHaveCount(1);
    let privateLens = customLenses.last();
    await privateLens.locator('.lens-name').fill('Private');
    await privateLens.locator('.lens-name').press('Tab');
    await expect(options.locator('#settings-status')).toHaveText('saved');

    privateLens = options.locator('.lens-card[data-lens-kind="terms"]').last();
    await privateLens.locator('.lens-term-input').fill('Mothbit');
    await privateLens.getByRole('button', { name: 'add terms' }).click();
    await expect(options.locator('#settings-status')).toHaveText('added 1');
    await expect(privateLens.locator('.term-chip')).toHaveCount(1);
    await expect(page.locator('#private [data-scrawlix-dom-root]')).toHaveCount(1);

    await options.getByRole('button', { name: '+ custom lens' }).click();
    customLenses = options.locator('.lens-card[data-lens-kind="terms"]');
    await expect(customLenses).toHaveCount(2);
    let spoilerLens = customLenses.last();
    await spoilerLens.locator('.lens-name').fill('Spoilers');
    await spoilerLens.locator('.lens-name').press('Tab');
    await expect(options.locator('#settings-status')).toHaveText('saved');

    spoilerLens = options.locator('.lens-card[data-lens-kind="terms"]').last();
    await spoilerLens.locator('.lens-term-input').fill('Rosebud');
    await spoilerLens.getByRole('button', { name: 'add terms' }).click();
    await expect(options.locator('#settings-status')).toHaveText('added 1');
    await expect(spoilerLens.locator('.term-chip')).toHaveCount(1);

    await options.getByRole('button', { name: 'new profile' }).click();
    await expect(options.locator('#profile option')).toHaveCount(2);
    await options.locator('#profile-name').fill('Presentation');
    await options.locator('#profile-name').press('Tab');
    await expect(options.locator('#settings-status')).toHaveText('saved');

    await options.locator('#appearance').selectOption('bar');
    await expect(options.locator('#settings-status')).toHaveText('saved');
    await options.locator('#coverage').selectOption('full');
    await expect(options.locator('#settings-status')).toHaveText('saved');
    await options.locator('#reveal').selectOption('never');
    await expect(options.locator('#settings-status')).toHaveText('saved');

    const profanityCard = options.locator(
      '.lens-card[data-lens-kind="english-profanity"]'
    );
    await profanityCard.locator('input[type="checkbox"]').uncheck();
    await expect(options.locator('#settings-status')).toHaveText('saved');

    await expect(page.locator('#initial [data-scrawlix-dom-root]')).toHaveCount(0);
    await expect(page.locator('#initial')).toHaveText('well, fuck this');

    const privateRoot = page.locator('#private [data-scrawlix-dom-root]');
    await expect(privateRoot).toHaveCount(1);
    await expect(privateRoot).toHaveAttribute('data-scrawlix-appearance', 'bar');
    await expect(privateRoot).toHaveAttribute('data-scrawlix-reveal', 'never');
    await expect(privateRoot.locator('[data-scrawlix-cover]')).toHaveText('Mothbit');

    await profilePicker.selectOption({ label: 'Everyday' });
    await expect(options.locator('#settings-status')).toHaveText('saved');
    await expect(page.locator('#initial [data-scrawlix-dom-root]')).toHaveCount(1);
    await expect(page.locator('#private [data-scrawlix-dom-root]')).toHaveCount(1);
    await expect(page.locator('#private [data-scrawlix-dom-root]')).toHaveAttribute(
      'data-scrawlix-appearance',
      'scrawl'
    );
  } finally {
    await context.close();
  }
});
