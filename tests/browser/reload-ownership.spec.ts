import { expect, test } from '@playwright/test';
import {
  extensionHighlightRanges,
  extensionWithPregrantedHosts,
  launchExtensionContext,
  serviceWorker,
} from './extension-harness';

test('built extension duplicate content execution never strands page-owned text', async ({}, testInfo) => {
  const extensionPath = await extensionWithPregrantedHosts(
    testInfo.outputPath('reload-extension-under-test')
  );
  const context = await launchExtensionContext(
    testInfo.outputPath('reload-extension-profile'),
    extensionPath
  );

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('http://127.0.0.1:4174/fixture.html');
    const fixtureUrl = page.url();

    await expect
      .poll(async () =>
        (await extensionHighlightRanges(context, fixtureUrl)).some(
          range => range.parentId === 'initial'
        )
      )
      .toBe(true);

    await page.evaluate(() => {
      const source = document.querySelector('#initial')?.firstChild ?? null;
      (window as Window & { __reloadSource?: ChildNode | null }).__reloadSource =
        source;
    });

    const worker = await serviceWorker(context);
    await worker.evaluate(async url => {
      const tabs = await chrome.tabs.query({});
      const tabId = tabs.find(tab => tab.url === url)?.id;
      if (tabId === undefined) throw new Error('Fixture tab was unavailable.');
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
    }, fixtureUrl);

    await expect(page.locator('#initial')).toHaveText('well, fuck this');
    await expect(page.locator('[data-scrawlix-dom-root]')).toHaveCount(0);
    expect(
      await page.evaluate(() => {
        const paragraph = document.querySelector('#initial')!;
        return {
          sameSource:
            paragraph.firstChild ===
            (window as Window & { __reloadSource?: ChildNode | null })
              .__reloadSource,
          data: paragraph.firstChild?.nodeValue,
          children: paragraph.childNodes.length,
        };
      })
    ).toEqual({ sameSource: true, data: 'well, fuck this', children: 1 });

    await page.evaluate(() => {
      const source = (window as Window & { __reloadSource?: Text }).__reloadSource!;
      source.data = 'well, fuck latest';
    });

    await expect(page.locator('#initial')).toHaveText('well, fuck latest');
    await expect
      .poll(async () =>
        (await extensionHighlightRanges(context, fixtureUrl)).some(
          range =>
            range.parentId === 'initial' &&
            range.sourceText === 'well, fuck latest'
        )
      )
      .toBe(true);

    await worker.evaluate(async url => {
      const tabs = await chrome.tabs.query({});
      const tabId = tabs.find(tab => tab.url === url)?.id;
      if (tabId === undefined) throw new Error('Fixture tab was unavailable.');
      await chrome.tabs.sendMessage(tabId, { type: 'scrawlix-disable' });
    }, fixtureUrl);

    await expect.poll(() => extensionHighlightRanges(context, fixtureUrl)).toEqual([]);
    expect(
      await page.evaluate(() => {
        const paragraph = document.querySelector('#initial')!;
        return {
          sameSource:
            paragraph.firstChild ===
            (window as Window & { __reloadSource?: ChildNode | null })
              .__reloadSource,
          data: paragraph.firstChild?.nodeValue,
          children: paragraph.childNodes.length,
        };
      })
    ).toEqual({ sameSource: true, data: 'well, fuck latest', children: 1 });
  } finally {
    await context.close();
  }
});

test('built extension runtime reload cannot orphan stale source or highlight offsets', async ({}, testInfo) => {
  const extensionPath = await extensionWithPregrantedHosts(
    testInfo.outputPath('runtime-reload-extension-under-test')
  );
  const context = await launchExtensionContext(
    testInfo.outputPath('runtime-reload-extension-profile'),
    extensionPath
  );

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('http://127.0.0.1:4174/fixture.html');
    const fixtureUrl = page.url();

    await expect
      .poll(async () =>
        (await extensionHighlightRanges(context, fixtureUrl)).some(
          range =>
            range.parentId === 'initial' &&
            range.text === 'uc' &&
            range.startOffset === 7 &&
            range.endOffset === 9
        )
      )
      .toBe(true);

    await page.evaluate(() => {
      const source = document.querySelector('#initial')?.firstChild ?? null;
      (window as Window & { __runtimeReloadSource?: ChildNode | null })
        .__runtimeReloadSource = source;
    });

    const originalWorker = await serviceWorker(context);
    const closed = originalWorker.waitForEvent('close');
    await originalWorker.evaluate(() => {
      setTimeout(() => chrome.runtime.reload(), 0);
      return true;
    });
    await closed;

    await expect
      .poll(() => context.serviceWorkers().length)
      .toBeGreaterThan(0);

    expect(
      await page.evaluate(() => {
        const paragraph = document.querySelector('#initial')!;
        return {
          sameSource:
            paragraph.firstChild ===
            (window as Window & { __runtimeReloadSource?: ChildNode | null })
              .__runtimeReloadSource,
          data: paragraph.firstChild?.nodeValue,
          children: paragraph.childNodes.length,
        };
      })
    ).toEqual({ sameSource: true, data: 'well, fuck this', children: 1 });
    await expect(page.locator('[data-scrawlix-dom-root]')).toHaveCount(0);

    await page.evaluate(() => {
      const source = (
        window as Window & { __runtimeReloadSource?: Text }
      ).__runtimeReloadSource!;
      source.data = 'prefix prefix fuck after reload';
    });

    await expect(page.locator('#initial')).toHaveText(
      'prefix prefix fuck after reload'
    );
    expect(
      await page.evaluate(() => {
        const paragraph = document.querySelector('#initial')!;
        return {
          sameSource:
            paragraph.firstChild ===
            (window as Window & { __runtimeReloadSource?: ChildNode | null })
              .__runtimeReloadSource,
          data: paragraph.firstChild?.nodeValue,
          children: paragraph.childNodes.length,
        };
      })
    ).toEqual({
      sameSource: true,
      data: 'prefix prefix fuck after reload',
      children: 1,
    });

    const ranges = await extensionHighlightRanges(context, fixtureUrl);
    const initialRanges = ranges.filter(range => range.parentId === 'initial');

    // Chrome may leave an existing tab uncovered across an extension reload, or
    // it may retain/re-establish a live isolated-world session. Both are source
    // safe. Any surviving presentation must track the page's new source range;
    // a stale/collapsed pre-reload Range is forbidden.
    if (initialRanges.length > 0) {
      expect(initialRanges).toEqual([
        expect.objectContaining({
          text: 'uc',
          startOffset: 15,
          endOffset: 17,
          sourceText: 'prefix prefix fuck after reload',
          sameTextNode: true,
        }),
      ]);
    }
  } finally {
    await context.close();
  }
});
