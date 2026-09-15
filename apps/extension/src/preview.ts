import { createScrawlix } from '@scrawlix/core';
import { englishStrongProfanityRules } from '@scrawlix/en';
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
    rules: englishStrongProfanityRules,
    coverage: coverageSelector(coverage),
  });
  const segments = engine.segment(TREATMENT_PREVIEW_TEXT);

  root.replaceChildren();
  root.setAttribute('data-scrawlix-dom-root', '');
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
    cover.dataset.scrawlixMatches = segment.matchIds.join(',');
    cover.dataset.scrawlixStart = String(segment.start);
    cover.dataset.scrawlixEnd = String(segment.end);
    if (segment.revealId) cover.dataset.scrawlixRevealId = segment.revealId;
    if (segment.coverageEdge) cover.dataset.scrawlixEdge = segment.coverageEdge;
    const mask = maskFor(segment.text, appearance);
    if (mask) cover.dataset.scrawlixMask = mask;
    cover.append(document.createTextNode(segment.text));
    root.append(cover);
  }
}
