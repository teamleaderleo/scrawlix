import type { ExtensionAppearance } from './config';

const SAFE_HIGHLIGHT_NAME = /^[a-z][a-z0-9-]*$/i;

export function highlightPresentationCss(
  highlightName: string,
  appearance: ExtensionAppearance
) {
  if (!SAFE_HIGHLIGHT_NAME.test(highlightName)) {
    throw new Error('Scrawlix highlight name contains unsupported characters.');
  }

  const treatment = (() => {
    switch (appearance) {
      case 'scrawl':
        return `
  background-color: GrayText;
  text-decoration-color: CanvasText;
  text-decoration-line: line-through;
  text-decoration-style: wavy;`;
      case 'blur':
        return `
  background-color: GrayText;
  text-shadow: 0 0 0.35em CanvasText;`;
      case 'bar':
      case 'asterisk':
      case 'grawlix':
        // Custom Highlights cannot synthesize replacement glyphs. Symbol-mask
        // appearances use the same opaque treatment as the bar while keeping
        // the page-owned Text and child tree untouched.
        return `
  background-color: CanvasText;`;
    }
  })();

  return `::highlight(${highlightName}) {
  color: transparent;${treatment}
}
`;
}
