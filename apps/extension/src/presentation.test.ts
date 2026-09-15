import { describe, expect, it } from 'vitest';
import { scopedPresentationCss } from './presentation';

describe('extension presentation ownership', () => {
  it('scopes every presentation rule to one opaque live-root token', () => {
    const css = scopedPresentationCss('sxl-test-token');

    expect(css).toContain(
      '[data-scrawlix-extension-owned="sxl-test-token"] [data-scrawlix-cover]'
    );
    expect(css).not.toMatch(/^\[data-scrawlix-dom-root\]/m);
    expect(css).not.toMatch(/^\[data-scrawlix-cover\]/m);
  });

  it('rejects tokens that could escape the generated selector', () => {
    expect(() => scopedPresentationCss('bad"] *')).toThrow(
      /unsupported characters/
    );
  });
});
