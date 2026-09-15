import { expect, test } from '@playwright/test';
import {
  extensionWithPregrantedHosts,
  launchExtensionContext,
  loadedExtensionId,
  registeredContentScript,
  serviceWorker,
} from './extension-harness';

test('demo controls drive real rendered coverage and reveal state', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173');

  const proof = page.locator('.proof-output [data-scrawlix-root]');
  const firstCover = proof.locator('[data-scrawlix-cover]').first();

  await expect(proof).toBeVisible();
  await expect(firstCover).toHaveAttribute('data-appearance', 'scrawl');
  await expect(firstCover).toHaveText('uc');

  await page.getByRole('button', { name: 'bar', exact: true }).click();
  await expect(firstCover).toHaveAttribute('data-appearance', 'bar');

  await page.getByRole('button', { name: 'full', exact: true }).click();
  await expect(firstCover).toHaveText('fuck');

  await page.getByRole('button', { name: 'click', exact: true }).click();
  await expect(proof).toHaveAttribute('data-reveal', 'click');
  await expect(proof).toHaveAttribute('data-revealed', 'false');

  await proof.click();
  await expect(proof).toHaveAttribute('data-revealed', 'true');

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('built extension persists top-document injection and page lifecycle behavior', async ({}, testInfo) => {
  const testExtensionPath = await extensionWithPregrantedHosts(
    testInfo.outputPath('extension-under-test')
  );
  const context = await launchExtensionContext(
    testInfo.outputPath('extension-profile'),
    testExtensionPath
  );

  try {
    await expect.poll(() => registeredContentScript(context)).toEqual({
      matches: ['http://*/*', 'https://*/*'],
      js: ['content.js'],
      css: [],
      runAt: 'document_idle',
      persistAcrossSessions: true,
      allFrames: false,
      matchOriginAsFallback: false,
    });

    const worker = await serviceWorker(context);
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('http://127.0.0.1:4174/fixture.html');

    const initialRoot = page.locator('#initial [data-scrawlix-dom-root]');
    await expect(initialRoot).toHaveCount(1);
    await expect(initialRoot).toHaveAttribute('data-scrawlix-extension-owned', /.+/);
    await expect(page.locator('#initial [data-scrawlix-cover]')).toHaveText('uc');
    await expect(page.locator('#private [data-scrawlix-dom-root]')).toHaveCount(0);
    await expect(page.locator('[data-scrawlix-dom-root][tabindex]')).toHaveCount(0);

    await expect(page.locator('#code [data-scrawlix-dom-root]')).toHaveCount(0);
    await expect(page.locator('#editable [data-scrawlix-dom-root]')).toHaveCount(0);
    await expect(page.locator('#native-button [data-scrawlix-dom-root]')).toHaveCount(0);
    await expect(page.locator('#native-link [data-scrawlix-dom-root]')).toHaveCount(1);

    await page.getByRole('button', { name: 'add dynamic' }).click();
    await expect(page.locator('#dynamic-copy [data-scrawlix-dom-root]')).toHaveCount(1);
    await expect(page.locator('#dynamic-copy [data-scrawlix-cover]')).toHaveText('uc');

    await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: 'http://127.0.0.1:4174/*' });
      const tabId = tabs.find(tab => tab.url?.endsWith('/fixture.html'))?.id;
      if (tabId === undefined) throw new Error('Fixture tab was unavailable.');
      await chrome.tabs.sendMessage(tabId, {
        type: 'scrawlix-reveal-for',
        durationMs: 300,
      });
    });
    await expect(page.locator('html')).toHaveAttribute(
      'data-scrawlix-page-revealed',
      'true'
    );
    await expect
      .poll(() => page.locator('html').getAttribute('data-scrawlix-page-revealed'))
      .toBeNull();
    await expect(initialRoot).toHaveCount(1);

    await page.evaluate(() => {
      const iframe = document.createElement('iframe');
      iframe.id = 'scope-frame';
      iframe.src = `${location.origin}/clicked.html`;
      document.body.append(iframe);
    });
    const child = page.frameLocator('#scope-frame');
    await expect(child.locator('#clicked')).toHaveText('native link worked');
    await expect(child.locator('[data-scrawlix-dom-root]')).toHaveCount(0);

    await page.evaluate(() => {
      const replacement = document.body.cloneNode(true) as HTMLBodyElement;
      const paragraph = document.createElement('p');
      paragraph.id = 'body-replacement-copy';
      paragraph.textContent = 'replacement fuck arrived';
      replacement.querySelector('main')?.append(paragraph);
      document.body.replaceWith(replacement);
    });
    await expect(page.locator('#body-replacement-copy [data-scrawlix-dom-root]')).toHaveCount(1);
    await expect(page.locator('#body-replacement-copy [data-scrawlix-cover]')).toHaveText('uc');
    await expect(page.locator('#initial [data-scrawlix-dom-root]')).toHaveCount(1);
    await expect(page.locator('[data-scrawlix-dom-root][tabindex]')).toHaveCount(0);

    await page.locator('#native-link').click();
    await expect(page).toHaveURL('http://127.0.0.1:4174/clicked.html');
    await expect(page.locator('#clicked')).toHaveText('native link worked');
  } finally {
    await context.close();
  }
});

test('built extension switches lens profiles and restores the live page', async ({}, testInfo) => {
  const testExtensionPath = await extensionWithPregrantedHosts(
    testInfo.outputPath('extension-under-test')
  );
  const context = await launchExtensionContext(
    testInfo.outputPath('extension-lens-profiles'),
    testExtensionPath
  );

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('http://127.0.0.1:4174/fixture.html');
    await expect(page.locator('#initial [data-scrawlix-dom-root]')).toHaveCount(1);
    await expect(page.locator('#private [data-scrawlix-dom-root]')).toHaveCount(0);

    const extensionId = await loadedExtensionId(context);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    const profilePicker = popup.locator('#profile');
    await expect(profilePicker).toHaveValue('profile:everyday');

    await popup.getByRole('button', { name: '+ lens' }).click();
    let customLenses = popup.locator('.lens-card[data-lens-kind="terms"]');
    await expect(customLenses).toHaveCount(1);
    await customLenses.last().locator('.lens-name').fill('Private');
    await customLenses.last().locator('textarea').fill('Mothbit');
    await expect(popup.locator('#local-save-status')).toHaveText('saved');
    await expect(page.locator('#private [data-scrawlix-dom-root]')).toHaveCount(1);

    await popup.getByRole('button', { name: '+ lens' }).click();
    customLenses = popup.locator('.lens-card[data-lens-kind="terms"]');
    await expect(customLenses).toHaveCount(2);
    await customLenses.last().locator('.lens-name').fill('Spoilers');
    await customLenses.last().locator('textarea').fill('Rosebud');
    await expect(popup.locator('#local-save-status')).toHaveText('saved');

    await popup.getByRole('button', { name: 'new', exact: true }).click();
    await popup.getByLabel('profile name').fill('Presentation');
    await popup.getByLabel('appearance').selectOption('bar');
    await popup.getByLabel('coverage').selectOption('full');
    await popup.getByLabel('reveal').selectOption('never');

    const profanityCard = popup.locator(
      '.lens-card[data-lens-kind="english-profanity"]'
    );
    await profanityCard.locator('input[type="checkbox"]').uncheck();
    await expect(popup.locator('#local-save-status')).toHaveText('saved');

    await expect(page.locator('#initial [data-scrawlix-dom-root]')).toHaveCount(0);
    await expect(page.locator('#initial')).toHaveText('well, fuck this');

    const privateRoot = page.locator('#private [data-scrawlix-dom-root]');
    await expect(privateRoot).toHaveCount(1);
    await expect(privateRoot).toHaveAttribute('data-scrawlix-appearance', 'bar');
    await expect(privateRoot).toHaveAttribute('data-scrawlix-reveal', 'never');
    await expect(privateRoot.locator('[data-scrawlix-cover]')).toHaveText('Mothbit');

    await profilePicker.selectOption({ label: 'Everyday' });
    await expect(page.locator('#initial [data-scrawlix-dom-root]')).toHaveCount(1);
    await expect(page.locator('#private [data-scrawlix-dom-root]')).toHaveCount(1);
    await expect(page.locator('#private [data-scrawlix-dom-root]')).toHaveAttribute(
      'data-scrawlix-appearance',
      'scrawl'
    );

    await popup.close();
  } finally {
    await context.close();
  }
});
