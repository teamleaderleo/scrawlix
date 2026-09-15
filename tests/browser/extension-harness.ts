import {
  chromium,
  expect,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const extensionPath = resolve(process.cwd(), 'apps/extension/dist');

export type ExtensionHighlightRangeSnapshot = {
  text: string;
  startOffset: number;
  endOffset: number;
  sourceText: string | null;
  parentId: string | null;
  sameTextNode: boolean;
};

/**
 * Browser E2E needs deterministic page access without automating Chrome's
 * permission prompt. Copy the built extension and promote its optional host
 * patterns only inside the throwaway test artifact. The shipping manifest in
 * apps/extension/dist remains optional-access only.
 */
export async function extensionWithPregrantedHosts(outputPath: string) {
  await rm(outputPath, { recursive: true, force: true });
  await cp(extensionPath, outputPath, { recursive: true });

  const manifestPath = resolve(outputPath, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.host_permissions = manifest.optional_host_permissions ?? [];
  delete manifest.optional_host_permissions;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return outputPath;
}

export async function launchExtensionContext(
  profilePath: string,
  extensionBuildPath: string
) {
  const context = await chromium.launchPersistentContext(profilePath, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionBuildPath}`,
      `--load-extension=${extensionBuildPath}`,
    ],
  });

  await expect
    .poll(async () => (await registeredContentScript(context))?.matches ?? [])
    .toEqual(['http://*/*', 'https://*/*']);

  return context;
}

export async function loadedExtensionId(context: BrowserContext) {
  const extensionsPage = await context.newPage();
  await extensionsPage.goto('chrome://extensions/');
  const items = extensionsPage.locator('extensions-item');
  await expect.poll(() => items.count()).toBeGreaterThan(0);

  const extensionId = await items.evaluateAll(elements => {
    for (const element of elements) {
      const item = element as HTMLElement & {
        data?: { id?: string; name?: string };
      };
      const text = item.shadowRoot?.textContent ?? '';
      if (
        item.data?.name === 'Scrawlix' ||
        text.toLowerCase().includes('scrawlix')
      ) {
        return item.id || item.data?.id || '';
      }
    }
    return '';
  });

  await extensionsPage.close();
  if (!extensionId) {
    throw new Error('Could not resolve the unpacked Scrawlix extension id.');
  }
  return extensionId;
}

export async function serviceWorker(context: BrowserContext) {
  return (
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker'))
  );
}

export async function registeredContentScript(context: BrowserContext) {
  const worker = await serviceWorker(context);
  return worker.evaluate(async () => {
    const scripts = await chrome.scripting.getRegisteredContentScripts({
      ids: ['scrawlix-page'],
    });
    const script = scripts[0];
    return script
      ? {
          matches: script.matches?.sort() ?? [],
          js: script.js?.sort() ?? [],
          css: script.css?.sort() ?? [],
          runAt: script.runAt ?? null,
          persistAcrossSessions: script.persistAcrossSessions,
          allFrames: script.allFrames,
          matchOriginAsFallback: script.matchOriginAsFallback,
        }
      : null;
  });
}

export async function extensionHighlightRanges(
  context: BrowserContext,
  pageUrl: string
): Promise<ExtensionHighlightRangeSnapshot[]> {
  const worker = await serviceWorker(context);
  return worker.evaluate(async url => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find(candidate => candidate.url === url);
    if (tab?.id === undefined) {
      throw new Error(`Could not resolve extension fixture tab for ${url}.`);
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'ISOLATED',
      func: () => {
        const registry = (
          CSS as unknown as {
            highlights?: { get(name: string): unknown };
          }
        ).highlights;
        const highlight = registry?.get('scrawlix-extension');
        if (!highlight) return [];

        const ranges = Array.from(
          (
            highlight as {
              values(): IterableIterator<Range>;
            }
          ).values()
        );

        return ranges.map(range => {
          const start = range.startContainer;
          const end = range.endContainer;
          const source = start.nodeType === Node.TEXT_NODE ? (start as Text) : null;

          return {
            text: range.toString(),
            startOffset: range.startOffset,
            endOffset: range.endOffset,
            sourceText: source?.data ?? null,
            parentId: source?.parentElement?.id ?? null,
            sameTextNode: start === end && source !== null,
          };
        });
      },
    });

    return (results[0]?.result ?? []) as ExtensionHighlightRangeSnapshot[];
  }, pageUrl);
}

/**
 * Inspect a retained tab after the MV3 worker has gone idle or the extension
 * has reloaded. Extension pages still have the scripting permission and do not
 * require the background worker to remain alive.
 */
export async function extensionHighlightRangesFromPage(
  extensionPage: Page,
  pageUrl: string
): Promise<ExtensionHighlightRangeSnapshot[]> {
  return extensionPage.evaluate(async url => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find(candidate => candidate.url === url);
    if (tab?.id === undefined) {
      throw new Error(`Could not resolve extension fixture tab for ${url}.`);
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'ISOLATED',
      func: () => {
        const registry = (
          CSS as unknown as {
            highlights?: { get(name: string): unknown };
          }
        ).highlights;
        const highlight = registry?.get('scrawlix-extension');
        if (!highlight) return [];

        return Array.from(
          (
            highlight as {
              values(): IterableIterator<Range>;
            }
          ).values()
        ).map(range => {
          const start = range.startContainer;
          const end = range.endContainer;
          const source = start.nodeType === Node.TEXT_NODE ? (start as Text) : null;
          return {
            text: range.toString(),
            startOffset: range.startOffset,
            endOffset: range.endOffset,
            sourceText: source?.data ?? null,
            parentId: source?.parentElement?.id ?? null,
            sameTextNode: start === end && source !== null,
          };
        });
      },
    });

    return (results[0]?.result ?? []) as ExtensionHighlightRangeSnapshot[];
  }, pageUrl);
}
