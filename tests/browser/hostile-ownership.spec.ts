import { expect, test } from '@playwright/test';
import {
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

    await page.evaluate(() => {
      const paragraph = document.createElement('p');
      paragraph.id = 'anchor-normalize';
      paragraph.textContent = 'fuck 0';
      document.body.append(paragraph);
      (window as any).__anchorSource = paragraph.firstChild;
    });

    const paragraph = page.locator('#anchor-normalize');
    await expect(paragraph).toHaveText('fuck 0');
    await expect(paragraph.locator('[data-scrawlix-dom-root]')).toHaveCount(1);

    await page.evaluate(() => {
      document.querySelector('#anchor-normalize')?.normalize();
    });

    await expect(paragraph).toHaveText('fuck 0');
    await expect(paragraph.locator('[data-scrawlix-dom-root]')).toHaveCount(1);
    expect(
      await page.evaluate(() => {
        const paragraph = document.querySelector('#anchor-normalize');
        return paragraph?.firstChild === (window as any).__anchorSource;
      })
    ).toBe(true);

    await page.evaluate(() => {
      const paragraph = document.querySelector('#anchor-normalize')!;
      const source = (window as any).__anchorSource as Text;
      source.data = 'fuck 1';
      source.remove();
      paragraph.append(source);
    });

    await expect(paragraph).toHaveText('fuck 1');
    await expect(paragraph.locator('[data-scrawlix-dom-root]')).toHaveCount(1);

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
    await expect(clone).toHaveText('fuck 1');
    await expect(clone.locator('[data-scrawlix-dom-root]')).toHaveCount(1);

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

    const ownedCover = paragraph.locator('[data-scrawlix-cover]');
    await expect(paragraph.locator('[data-scrawlix-dom-root]')).toHaveAttribute(
      'data-scrawlix-extension-owned',
      /.+/
    );
    expect(await ownedCover.evaluate(element => getComputedStyle(element).position)).toBe(
      'relative'
    );

    await page.evaluate(() => {
      const replacement = document.documentElement.cloneNode(true);
      document.replaceChild(replacement, document.documentElement);
    });

    await expect(page.locator('#anchor-normalize')).toHaveText('fuck 1');
    await expect(
      page.locator('#anchor-normalize [data-scrawlix-dom-root]')
    ).toHaveCount(1);
    await expect(page.locator('#anchor-clone')).toHaveText('fuck 1');
    await expect(
      page.locator('#anchor-clone [data-scrawlix-dom-root]')
    ).toHaveCount(1);
    await expect(page.locator('#anchor-fake-root')).toHaveAttribute(
      'data-scrawlix-extension-owned',
      ''
    );

    expect(browserErrors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('built extension keeps owned presentation scoped under strict page CSP', async ({}, testInfo) => {
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

    const ownedRoot = page.locator('#csp-copy [data-scrawlix-dom-root]');
    const ownedCover = ownedRoot.locator('[data-scrawlix-cover]');
    await expect(ownedRoot).toHaveCount(1);
    await expect(ownedRoot).toHaveAttribute('data-scrawlix-extension-owned', /.+/);
    expect(await ownedCover.evaluate(element => getComputedStyle(element).position)).toBe(
      'relative'
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
