import { createScrawlix } from '@scrawlix/core';
import { englishProfanityRules } from '@scrawlix/en';
import {
  coverageSelector,
  maskFor,
  type ExtensionAppearance,
  type ExtensionCoverage,
} from './config';

export const TREATMENT_PREVIEW_TEXT = 'motherfucker';

export function renderTreatmentPreview(
  root: HTMLElement,
  {
    appearance,
    coverage,
  }: {
    appearance: ExtensionAppearance;
    coverage: ExtensionCoverage;
  }
) {
  const engine = createScrawlix({
    rules: englishProfanityRules,
    coverage: coverageSelector(coverage),
  });
  const segments = engine.segment(TREATMENT_PREVIEW_TEXT);

  root.replaceChildren();
  root.setAttribute('data-scrawlix-root', '');
  root.dataset.scrawlixAppearance = appearance;
  root.dataset.scrawlixReveal = 'never';
  root.dataset.scrawlixRevealed = 'false';

  for (const segment of segments) {
    if (!segment.covered) {
      root.append(document.createTextNode(segment.text));
      continue;
    }

    const cover = document.createElement('span');
    cover.setAttribute('data-scrawlix-cover', '');
    cover.dataset.scrawlixRules = segment.ruleIds.join(',');
    const mask = maskFor(segment.text, appearance);
    if (mask) cover.dataset.scrawlixMask = mask;
    cover.append(document.createTextNode(segment.text));
    root.append(cover);
  }
}
