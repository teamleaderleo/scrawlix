/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest';
import { renderTreatmentPreview, TREATMENT_PREVIEW_TEXT } from './preview';

afterEach(() => {
  document.body.replaceChildren();
});

function previewRoot() {
  const root = document.createElement('div');
  document.body.append(root);
  return root;
}

describe('popup treatment preview', () => {
  it('uses the real semantic target and middle coverage', () => {
    const root = previewRoot();

    renderTreatmentPreview(root, {
      appearance: 'scrawl',
      coverage: 'middle',
    });

    const cover = root.querySelector<HTMLElement>('[data-scrawlix-cover]')!;
    expect(root.textContent).toBe(TREATMENT_PREVIEW_TEXT);
    expect(root.dataset.scrawlixAppearance).toBe('scrawl');
    expect(root.dataset.scrawlixReveal).toBe('never');
    expect(cover.textContent).toBe('uc');
    expect(cover.dataset.scrawlixMask).toBeUndefined();
  });

  it('updates the same root for full mosaic coverage', () => {
    const root = previewRoot();

    renderTreatmentPreview(root, {
      appearance: 'scrawl',
      coverage: 'middle',
    });
    renderTreatmentPreview(root, {
      appearance: 'mosaic',
      coverage: 'full',
    });

    const covers = root.querySelectorAll<HTMLElement>('[data-scrawlix-cover]');
    expect(covers).toHaveLength(1);
    expect(root.dataset.scrawlixAppearance).toBe('mosaic');
    expect(covers[0]!.textContent).toBe('fuck');
    expect(root.textContent).toBe(TREATMENT_PREVIEW_TEXT);
  });

  it('reuses the extension symbol-mask semantics', () => {
    const root = previewRoot();

    renderTreatmentPreview(root, {
      appearance: 'asterisk',
      coverage: 'middle',
    });

    const cover = root.querySelector<HTMLElement>('[data-scrawlix-cover]')!;
    expect(cover.textContent).toBe('uc');
    expect(cover.dataset.scrawlixMask).toBe('**');
  });
});
