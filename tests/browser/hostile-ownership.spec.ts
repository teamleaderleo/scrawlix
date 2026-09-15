import { expect, test } from '@playwright/test';
import {
  extensionHighlightRanges,
  extensionWithPregrantedHosts,
  launchExtensionContext,
} from './extension-harness';

test('built extension preserves hostile DOM ownership and full html replacement', async ({}, testInfo) => {
  const testExtensionPath = await extensionWithPregrantedHosts(
    testInfo.outputPath('extension-under-test')
  );
  const context = await launchExtensionContext(
    testInfo.outputPath('extension-hostile-ownership'),
    testExtensionPath
  );

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    const browserErrors: string[] = [];
    page.on('console', message => {
      if (
        message.type() === 'error' &&
        !message.text().startsWith('Failed to load resource:')
      ) {
        browserErrors.push(message.text());
      }
    });
    page.on('pageerror', error => browserErrors.push(error.message));

    await page.goto('http://127.0.0.1:4174/fixture.html');
    const fixtureUrl = page.url();

    await page.evaluate(() => {
      const paragraph = document.createElement('p');
      paragraph.id = 'anchor-normalize';
      paragraph.textContent = 'fuck 0';
      document.body.append(paragraph);
      (window as Window & { __anchorSource?: ChildNode | null }).__anchorSource =
        paragraph.firstChild;
    });

    const paragraph = page.locator('#anchor-normalize');
    await expect(paragraph).toHaveText('fuck 0');
    await expect(page.locator('[data-scrawlix-dom-root]')).toHaveCount(0);
    await expect
      .poll(async () => extensionHighlightRanges(context, fixtureUrl))
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            parentId: 'anchor-normalize',
            text: 'uc',
            sourceText: 'fuck 0',
          }),
        ])
      );

    await page.evaluate(() => {
      document.querySelector('#anchor-normalize')?.normalize();
    });

    await expect(paragraph).toHaveText('fuck 0');
    expect(
      await page.evaluate(() => {
        const paragraph = document.querySelector('#anchor-normalize');
        return {
          sameSource:
            paragraph?.firstChild ===
            (window as Window & { __anchorSource?: ChildNode | null })
              .__anchorSource,
          data: paragraph?.firstChild?.nodeValue,
          children: paragraph?.childNodes.length,
        };
      })
    ).toEqual({ sameSource: true, data: 'fuck 0', children: 1 });

    await page.evaluate(() => {
      const paragraph = document.querySelector('#anchor-normalize')!;
      const source = (window as Window & { __anchorSource?: Text }).__anchorSource!;
      source.data = 'fuck stale';
      source.data = 'fuck latest';
      source.remove();
      paragraph.append(source);
    });

    await expect(paragraph).toHaveText('fuck latest');
    expect(
      await page.evaluate(() => {
        const paragraph = document.querySelector('#anchor-normalize');
        const source = (window as Window & { __anchorSource?: Text }).__anchorSource;
        return {
          sameSource: paragraph?.firstChild === source,
          data: source?.data,
        };
      })
    ).toEqual({ sameSource: true, data: 'fuck latest' });
    await expect
      .poll(async () => extensionHighlightRanges(context, fixtureUrl))
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            parentId: 'anchor-normalize',
            text: 'uc',
            sourceText: 'fuck latest',
          }),
        ])
      );

    await page.evaluate(() => {
      const paragraph = document.querySelector('#anchor-normalize')!;
      const clone = paragraph.cloneNode(true) as HTMLElement;
      clone.id = 'anchor-clone';
      paragraph.after(clone);

      const fakeRoot = document.createElement('div');
      fakeRoot.id = 'anchor-fake-root';
      fakeRoot.setAttribute('data-scrawlix-dom-root', '');
      fakeRoot.setAttribute('data-scrawlix-extension-owned', '');
      fakeRoot.setAttribute('data-scrawlix-appearance', 'scrawl');
      fakeRoot.setAttribute('data-scrawlix-reveal', 'click');
      fakeRoot.setAttribute('data-scrawlix-revealed', 'true');
      fakeRoot.tabIndex = 7;

      const fakeCover = document.createElement('span');
      fakeCover.id = 'anchor-fake-cover';
      fakeCover.setAttribute('data-scrawlix-cover', '');
      fakeCover.setAttribute('data-scrawlix-rules', 'author');
      fakeCover.setAttribute('data-scrawlix-mask', 'author');
      fakeCover.textContent = 'safe';
      fakeRoot.append(fakeCover);
      clone.after(fakeRoot);
    });

    const clone = page.locator('#anchor-clone');
    await expect(clone).toHaveText('fuck latest');
    expect(
      await clone.evaluate(element => ({
        children: element.childNodes.length,
        type: element.firstChild?.nodeType,
        data: element.firstChild?.nodeValue,
      }))
    ).toEqual({ children: 1, type: 3, data: 'fuck latest' });
    await expect
      .poll(async () => extensionHighlightRanges(context, fixtureUrl))
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({ parentId: 'anchor-clone', text: 'uc' }),
        ])
      );

    const fakeRoot = page.locator('#anchor-fake-root');
    const fakeCover = page.locator('#anchor-fake-cover');
    await expect(fakeRoot).toHaveText('safe');
    await expect(fakeRoot).toHaveAttribute('data-scrawlix-extension-owned', '');
    await expect(fakeRoot).toHaveAttribute('tabindex', '7');
    await expect(fakeCover).toHaveAttribute('data-scrawlix-mask', 'author');

    expect(
      await fakeCover.evaluate(element => {
        const style = getComputedStyle(element);
        return {
          display: style.display,
          position: style.position,
          fill: style.webkitTextFillColor,
          after: getComputedStyle(element, '::after').content,
        };
      })
    ).toEqual({
      display: 'inline',
      position: 'static',
      fill: expect.not.stringMatching(/transparent/),
      after: 'none',
    });
    expect(
      (await extensionHighlightRanges(context, fixtureUrl)).some(
        range => range.parentId === 'anchor-fake-cover'
      )
    ).toBe(false);

    await page.evaluate(() => {
      const replacement = document.documentElement.cloneNode(true);
      document.replaceChild(replacement, document.documentElement);
    });

    await expect(page.locator('#anchor-normalize')).toHaveText('fuck latest');
    await expect(page.locator('#anchor-clone')).toHaveText('fuck latest');
    await expect(page.locator('[data-scrawlix-dom-root]')).toHaveCount(1);
    await expect(page.locator('#anchor-fake-root')).toHaveAttribute(
      'data-scrawlix-extension-owned',
      ''
    );
    await expect
      .poll(async () => extensionHighlightRanges(context, fixtureUrl))
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({ parentId: 'anchor-normalize', text: 'uc' }),
          expect.objectContaining({ parentId: 'anchor-clone', text: 'uc' }),
        ])
      );

    expect(browserErrors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('built extension keeps highlight presentation active under strict page CSP', async ({}, testInfo) => {
  const testExtensionPath = await extensionWithPregrantedHosts(
    testInfo.outputPath('extension-under-test')
  );
  const context = await launchExtensionContext(
    testInfo.outputPath('extension-csp-presentation'),
    testExtensionPath
  );

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('http://127.0.0.1:4174/csp.html');
    const fixtureUrl = page.url();

    await expect(page.locator('#csp-copy')).toHaveText(/fuck/);
    await expect(page.locator('[data-scrawlix-dom-root]')).toHaveCount(1);
    await expect
      .poll(async () => extensionHighlightRanges(context, fixtureUrl))
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({ parentId: 'csp-copy', text: 'uc' }),
        ])
      );

    const fakeCover = page.locator('#csp-fake-cover');
    expect(
      await fakeCover.evaluate(element => ({
        display: getComputedStyle(element).display,
        position: getComputedStyle(element).position,
        after: getComputedStyle(element, '::after').content,
      }))
    ).toEqual({ display: 'inline', position: 'static', after: 'none' });
  } finally {
    await context.close();
  }
});
