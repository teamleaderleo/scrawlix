import { chromium, expect, test } from '@playwright/test';
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const extensionPath = resolve(process.cwd(), 'apps/extension/dist');

function extensionWithPregrantedHosts(outputPath: string) {
  cpSync(extensionPath, outputPath, { recursive: true });

  const manifestPath = resolve(outputPath, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.host_permissions = manifest.optional_host_permissions ?? [];
  delete manifest.optional_host_permissions;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return outputPath;
}

async function launchExtensionContext(profilePath: string, unpackedPath: string) {
  return chromium.launchPersistentContext(profilePath, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${unpackedPath}`,
      `--load-extension=${unpackedPath}`,
    ],
  });
}

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

test('built extension registers granted hosts and handles page interaction in Chromium', async ({}, testInfo) => {
  const testExtensionPath = extensionWithPregrantedHosts(
    testInfo.outputPath('extension-under-test')
  );
  const context = await launchExtensionContext(
    testInfo.outputPath('extension-profile'),
    testExtensionPath
  );

  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await expect
      .poll(async () =>
        worker.evaluate(async () => {
          const scripts = await chrome.scripting.getRegisteredContentScripts({
            ids: ['scrawlix-page'],
          });
          return {
            matches: scripts[0]?.matches?.sort() ?? [],
            runAt: scripts[0]?.runAt ?? null,
          };
        })
      )
      .toEqual({
        matches: ['http://*/*', 'https://*/*'],
        runAt: 'document_start',
      });

    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('http://127.0.0.1:4174/fixture.html');

    const initialRoot = page.locator('#initial [data-scrawlix-dom-root]');
    await expect(initialRoot).toHaveCount(1);
    await expect(initialRoot).toHaveAttribute('data-scrawlix-extension-owned', '');
    await expect(
      page.locator('#initial [data-scrawlix-cover]')
    ).toHaveText('uc');

    await expect(page.locator('#code [data-scrawlix-dom-root]')).toHaveCount(0);
    await expect(page.locator('#editable [data-scrawlix-dom-root]')).toHaveCount(0);
    await expect(
      page.locator('#native-button [data-scrawlix-dom-root]')
    ).toHaveCount(0);

    // Links retain their native semantics even when their text is transformed.
    await expect(
      page.locator('#native-link [data-scrawlix-dom-root]')
    ).toHaveCount(1);

    await page.getByRole('button', { name: 'add dynamic' }).click();
    await expect(
      page.locator('#dynamic-copy [data-scrawlix-dom-root]')
    ).toHaveCount(1);
    await expect(
      page.locator('#dynamic-copy [data-scrawlix-cover]')
    ).toHaveText('uc');

    // Temporary reveal changes presentation only. Owned censor DOM stays in place.
    await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: 'http://127.0.0.1:4174/*' });
      const tabId = tabs.find(tab => tab.url?.endsWith('/fixture.html'))?.id;
      if (tabId === undefined) throw new Error('Fixture tab was unavailable.');
      await chrome.tabs.sendMessage(tabId, {
        type: 'scrawlix-reveal-for',
        durationMs: 500,
      });
    });

    await expect(page.locator('html')).toHaveAttribute(
      'data-scrawlix-page-revealed',
      'true'
    );
    await expect(initialRoot).toHaveCount(1);
    await expect
      .poll(() => page.locator('html').getAttribute('data-scrawlix-page-revealed'))
      .toBeNull();
    await expect(initialRoot).toHaveCount(1);

    // Click reveal stays pointer-local without inserting arbitrary text into tab order.
    await worker.evaluate(async () => {
      await chrome.storage.sync.set({
        scrawlixSettings: {
          paused: false,
          enabled: true,
          appearance: 'scrawl',
          coverage: 'middle',
          reveal: 'click',
        },
      });
    });
    await expect(initialRoot).toHaveAttribute('data-scrawlix-reveal', 'click');
    await expect(page.locator('[data-scrawlix-dom-root][tabindex]')).toHaveCount(0);
    await initialRoot.click();
    await expect(initialRoot).toHaveAttribute('data-scrawlix-revealed', 'true');
    await initialRoot.click();
    await expect(initialRoot).toHaveAttribute('data-scrawlix-revealed', 'false');

    // Full-tab Options uses the real engine for its specimen and edits the live custom list.
    const optionsUrl = await worker.evaluate(() => chrome.runtime.getURL('options.html'));
    const options = await context.newPage();
    await options.goto(optionsUrl);
    await expect(options.getByRole('heading', { name: 'Custom terms' })).toBeVisible();
    await expect(options.locator('#reveal')).toHaveValue('click');
    await expect(
      options.locator('#preview-stage [data-scrawlix-cover]')
    ).toHaveText('othb');

    await options.locator('#new-terms').fill('Mothbit');
    await options.getByRole('button', { name: 'add terms', exact: true }).click();
    await expect(options.locator('#term-list')).toContainText('Mothbit');
    await expect(options.locator('#custom-count')).toHaveText('1 term');

    await page.evaluate(() => {
      const paragraph = document.createElement('p');
      paragraph.id = 'custom-term-copy';
      paragraph.textContent = 'Mothbit arrived';
      document.querySelector('main')?.append(paragraph);
    });
    await expect(
      page.locator('#custom-term-copy [data-scrawlix-dom-root]')
    ).toHaveCount(1);
    await expect(
      page.locator('#custom-term-copy [data-scrawlix-cover]')
    ).toHaveText('othb');
    await expect(page.locator('[data-scrawlix-dom-root][tabindex]')).toHaveCount(0);

    await options.getByRole('button', { name: 'Remove Mothbit' }).click();
    await expect(options.locator('#term-list')).not.toContainText('Mothbit');
    await expect(options.locator('#custom-count')).toHaveText('0 terms');
    await expect(
      page.locator('#custom-term-copy [data-scrawlix-dom-root]')
    ).toHaveCount(0);
    await options.close();

    // Some SPA runtimes replace the complete body. A clone can carry copied Scrawlix
    // wrappers that belong to no live controller; unwrap/reprocess them and reconnect.
    await page.evaluate(() => {
      const replacement = document.body.cloneNode(true) as HTMLBodyElement;
      const paragraph = document.createElement('p');
      paragraph.id = 'body-replacement-copy';
      paragraph.textContent = 'replacement fuck arrived';
      replacement.querySelector('main')?.append(paragraph);
      document.body.replaceWith(replacement);
    });

    await expect(
      page.locator('#body-replacement-copy [data-scrawlix-dom-root]')
    ).toHaveCount(1);
    await expect(
      page.locator('#body-replacement-copy [data-scrawlix-cover]')
    ).toHaveText('uc');
    await expect(page.locator('#initial [data-scrawlix-dom-root]')).toHaveCount(1);
    await expect(
      page.locator('#initial [data-scrawlix-dom-root]')
    ).toHaveAttribute('data-scrawlix-extension-owned', '');
    await expect(page.locator('[data-scrawlix-dom-root][tabindex]')).toHaveCount(0);
    await expect(
      page.locator('#native-link [data-scrawlix-dom-root]')
    ).toHaveCount(1);

    // Native controls remain native under click reveal; Scrawlix does not intercept the link.
    await page.locator('#native-link').click();
    await expect(page).toHaveURL('http://127.0.0.1:4174/clicked.html');
    await expect(page.locator('#clicked')).toHaveText('native link worked');
  } finally {
    await context.close();
  }
});

test('built extension persists forced-host policy and treatment across browser restart', async ({}, testInfo) => {
  const testExtensionPath = extensionWithPregrantedHosts(
    testInfo.outputPath('state-extension-under-test')
  );
  const profilePath = testInfo.outputPath('state-extension-profile');

  const firstContext = await launchExtensionContext(profilePath, testExtensionPath);
  try {
    const worker =
      firstContext.serviceWorkers()[0] ??
      (await firstContext.waitForEvent('serviceworker'));
    const page = firstContext.pages()[0] ?? (await firstContext.newPage());
    await page.goto('http://127.0.0.1:4174/fixture.html');

    const root = page.locator('#initial [data-scrawlix-dom-root]');
    await expect(root).toHaveCount(1);

    // Default-off + forced-on is the allowlist configuration. Keep it active while
    // changing treatment so global/default changes cannot accidentally tear it down.
    await worker.evaluate(async () => {
      await chrome.storage.sync.set({
        scrawlixSettings: {
          paused: false,
          enabled: false,
          appearance: 'bar',
          coverage: 'full',
          reveal: 'never',
        },
      });
      await chrome.storage.local.set({
        scrawlixSiteOverrides: { '127.0.0.1': 'on' },
      });
    });

    await expect(root).toHaveAttribute('data-scrawlix-appearance', 'bar');
    await expect(root).toHaveAttribute('data-scrawlix-reveal', 'never');
    await expect(page.locator('#initial [data-scrawlix-cover]')).toHaveText('fuck');

    await page.evaluate(() => {
      (window as typeof window & { __scrawlixRoot?: Element | null }).__scrawlixRoot =
        document.querySelector('#initial [data-scrawlix-dom-root]');
    });

    await worker.evaluate(async () => {
      const stored = (await chrome.storage.sync.get('scrawlixSettings'))
        .scrawlixSettings as Record<string, unknown>;
      await chrome.storage.sync.set({
        scrawlixSettings: { ...stored, appearance: 'blur' },
      });
    });

    await expect(root).toHaveAttribute('data-scrawlix-appearance', 'blur');
    expect(
      await page.evaluate(() => {
        const saved = (window as typeof window & { __scrawlixRoot?: Element | null })
          .__scrawlixRoot;
        return saved === document.querySelector('#initial [data-scrawlix-dom-root]');
      })
    ).toBe(true);

    // Master pause wins even over an explicit forced-on hostname and restores exact source.
    await worker.evaluate(async () => {
      const stored = (await chrome.storage.sync.get('scrawlixSettings'))
        .scrawlixSettings as Record<string, unknown>;
      await chrome.storage.sync.set({
        scrawlixSettings: { ...stored, paused: true },
      });
    });
    await expect(root).toHaveCount(0);
    await expect(page.locator('#initial')).toHaveText('well, fuck this');

    await worker.evaluate(async () => {
      const stored = (await chrome.storage.sync.get('scrawlixSettings'))
        .scrawlixSettings as Record<string, unknown>;
      await chrome.storage.sync.set({
        scrawlixSettings: { ...stored, paused: false },
      });
    });
    await expect(root).toHaveCount(1);
    await expect(root).toHaveAttribute('data-scrawlix-appearance', 'blur');
    await expect(page.locator('#initial [data-scrawlix-cover]')).toHaveText('fuck');
  } finally {
    await firstContext.close();
  }

  // Relaunch Chromium against the exact same persistent profile: sync/local settings and
  // dynamic registration must reconstruct the same effective page behavior.
  const secondContext = await launchExtensionContext(profilePath, testExtensionPath);
  try {
    const worker =
      secondContext.serviceWorkers()[0] ??
      (await secondContext.waitForEvent('serviceworker'));
    const page = secondContext.pages()[0] ?? (await secondContext.newPage());
    await page.goto('http://127.0.0.1:4174/fixture.html');

    const root = page.locator('#initial [data-scrawlix-dom-root]');
    await expect(root).toHaveCount(1);
    await expect(root).toHaveAttribute('data-scrawlix-appearance', 'blur');
    await expect(root).toHaveAttribute('data-scrawlix-reveal', 'never');
    await expect(page.locator('#initial [data-scrawlix-cover]')).toHaveText('fuck');

    const stored = await worker.evaluate(async () => {
      const sync = (await chrome.storage.sync.get('scrawlixSettings')).scrawlixSettings;
      const local = (await chrome.storage.local.get('scrawlixSiteOverrides'))
        .scrawlixSiteOverrides;
      return { sync, local };
    });

    expect(stored.sync).toEqual({
      paused: false,
      enabled: false,
      appearance: 'blur',
      coverage: 'full',
      reveal: 'never',
    });
    expect(stored.local).toEqual({ '127.0.0.1': 'on' });
  } finally {
    await secondContext.close();
  }
});
