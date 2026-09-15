import { expect, test } from '@playwright/test';
import {
  extensionHighlightRanges,
  extensionWithPregrantedHosts,
  launchExtensionContext,
  registeredContentScript,
  serviceWorker,
} from './extension-harness';

test('demo controls drive real rendered coverage, X-ray, and reveal state', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173');

  const proof = page.locator('.proof-output [data-scrawlix-root]');
  const firstCover = proof.locator('[data-scrawlix-cover]').first();
  const secondCover = proof.locator('[data-scrawlix-cover]').nth(1);
  const xrayGrid = page.locator('#xray-grid');
  const xrayCoverage = page.locator('[data-xray-stage="cover"] .xray-coverage mark');

  await expect(proof).toBeVisible();
  await expect(proof).toHaveAttribute('data-scrawlix-appearance', 'scrawl');
  await expect(proof).toHaveAttribute('data-scrawlix-reveal-scope', 'match');
  await expect(firstCover).toHaveText('uc');

  await expect(xrayGrid).toBeVisible();
  await expect(page.locator('[data-xray-stage="match"] .xray-value')).toHaveText(
    'motherfucker'
  );
  await expect(page.locator('[data-xray-stage="target"] mark')).toHaveText('fuck');
  await expect(xrayCoverage).toHaveText('uc');

  await page.getByRole('button', { name: 'bar', exact: true }).click();
  await expect(proof).toHaveAttribute('data-scrawlix-appearance', 'bar');
  await expect(
    page.locator('[data-xray-stage="output"] [data-scrawlix-root]')
  ).toHaveAttribute('data-scrawlix-appearance', 'bar');

  await page.getByRole('button', { name: 'full', exact: true }).click();
  await expect(firstCover).toHaveText('fuck');
  await expect(xrayCoverage).toHaveText('fuck');

  for (const appearance of ['whiteout', 'mosaic', 'asterisk'] as const) {
    await page.getByRole('button', { name: appearance, exact: true }).click();
    await expect(proof).toHaveAttribute('data-scrawlix-appearance', appearance);
  }
  await expect(firstCover).toHaveAttribute('data-scrawlix-mask', '****');
  const beforeRevealBox = await firstCover.boundingBox();

  await page.getByRole('button', { name: 'click', exact: true }).click();
  await expect(proof).toHaveAttribute('data-scrawlix-reveal', 'click');
  await expect(proof).toHaveAttribute('data-scrawlix-revealed', 'false');
  await expect(firstCover).toHaveAttribute('data-scrawlix-revealed', 'false');
  await expect(secondCover).toHaveAttribute('data-scrawlix-revealed', 'false');

  await firstCover.click();
  await expect(firstCover).toHaveAttribute('data-scrawlix-revealed', 'true');
  await expect(secondCover).toHaveAttribute('data-scrawlix-revealed', 'false');
  await expect(proof).toHaveAttribute('data-scrawlix-revealed', 'false');
  const afterRevealBox = await firstCover.boundingBox();

  if (!beforeRevealBox || !afterRevealBox) {
    throw new Error('Expected the first covered segment to retain a layout box.');
  }
  expect(Math.abs(beforeRevealBox.width - afterRevealBox.width)).toBeLessThan(0.5);

  await page.getByRole('button', { name: 'component', exact: true }).click();
  await expect(proof).toHaveAttribute('data-scrawlix-reveal-scope', 'component');
  await expect(proof).toHaveAttribute('data-scrawlix-revealed', 'false');
  await proof.click();
  await expect(proof).toHaveAttribute('data-scrawlix-revealed', 'true');

  await page.getByRole('button', { name: 'x-ray on', exact: true }).click();
  await expect(xrayGrid).toHaveCount(0);
  await page.getByRole('button', { name: 'x-ray off', exact: true }).click();
  await expect(xrayGrid).toBeVisible();

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
    const fixtureUrl = page.url();

    await expect(page.locator('#initial')).toHaveText('well, fuck this');
    expect(
      await page.locator('#initial').evaluate(element => ({
        childNodes: element.childNodes.length,
        firstType: element.firstChild?.nodeType,
        firstData: element.firstChild?.nodeValue,
        html: element.innerHTML,
      }))
    ).toEqual({
      childNodes: 1,
      firstType: 3,
      firstData: 'well, fuck this',
      html: 'well, fuck this',
    });

    await expect
      .poll(async () => extensionHighlightRanges(context, fixtureUrl))
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            parentId: 'initial',
            text: 'uc',
            sourceText: 'well, fuck this',
            sameTextNode: true,
          }),
          expect.objectContaining({ parentId: 'native-link', text: 'uc' }),
        ])
      );

    const initialRanges = await extensionHighlightRanges(context, fixtureUrl);
    expect(initialRanges.some(range => range.parentId === 'private')).toBe(false);
    expect(initialRanges.some(range => range.parentId === 'code')).toBe(false);
    expect(initialRanges.some(range => range.parentId === 'editable')).toBe(false);
    expect(initialRanges.some(range => range.parentId === 'native-button')).toBe(false);
    await expect(page.locator('[data-scrawlix-dom-root]')).toHaveCount(0);

    await page.getByRole('button', { name: 'add dynamic' }).click();
    await expect(page.locator('#dynamic-copy')).toHaveText('dynamic fuck arrived');
    await expect
      .poll(async () => extensionHighlightRanges(context, fixtureUrl))
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({ parentId: 'dynamic-copy', text: 'uc' }),
        ])
      );

    await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: 'http://127.0.0.1:4174/*' });
      const tabId = tabs.find(tab => tab.url?.endsWith('/fixture.html'))?.id;
      if (tabId === undefined) throw new Error('Fixture tab was unavailable.');
      await chrome.tabs.sendMessage(tabId, {
        type: 'scrawlix-reveal-for',
        durationMs: 300,
      });
    });
    await expect.poll(() => extensionHighlightRanges(context, fixtureUrl)).toEqual([]);
    await expect
      .poll(async () =>
        (await extensionHighlightRanges(context, fixtureUrl)).some(
          range => range.parentId === 'initial' && range.text === 'uc'
        )
      )
      .toBe(true);

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
    await expect(page.locator('#body-replacement-copy')).toHaveText(
      'replacement fuck arrived'
    );
    await expect(page.locator('#initial')).toHaveText('well, fuck this');
    await expect(page.locator('[data-scrawlix-dom-root]')).toHaveCount(0);
    await expect
      .poll(async () => extensionHighlightRanges(context, fixtureUrl))
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({ parentId: 'body-replacement-copy', text: 'uc' }),
          expect.objectContaining({ parentId: 'initial', text: 'uc' }),
        ])
      );

    await page.locator('#native-link').click();
    await expect(page).toHaveURL('http://127.0.0.1:4174/clicked.html');
    await expect(page.locator('#clicked')).toHaveText('native link worked');
  } finally {
    await context.close();
  }
});
