import { describe, expect, it } from 'vitest';
import { highlightPresentationCss } from './presentation';

describe('extension highlight presentation', () => {
  it('styles only one named Custom Highlight without marker selectors', () => {
    const css = highlightPresentationCss('scrawlix-extension', 'scrawl');

    expect(css).toContain('::highlight(scrawlix-extension)');
    expect(css).toContain('color: transparent');
    expect(css).toContain('text-decoration-style: wavy');
    expect(css).not.toContain('data-scrawlix-dom-root');
    expect(css).not.toContain('data-scrawlix-cover');
  });

  it('uses an opaque highlight for symbol appearances that cannot synthesize glyphs', () => {
    expect(highlightPresentationCss('scrawlix-extension', 'asterisk')).toContain(
      'background-color: CanvasText'
    );
    expect(highlightPresentationCss('scrawlix-extension', 'grawlix')).toContain(
      'background-color: CanvasText'
    );
  });

  it('rejects names that could escape the highlight selector', () => {
    expect(() => highlightPresentationCss('bad) *', 'bar')).toThrow(
      /unsupported characters/
    );
  });
});
