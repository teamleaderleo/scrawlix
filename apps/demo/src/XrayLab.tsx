import {
  createScrawlix,
  type CoverageSelector,
  type ScrawlixLocatedSegment,
} from '@scrawlix/core';
import { englishStrongProfanityRules } from '@scrawlix/en';
import {
  CensoredText,
  type ScrawlixAppearance,
  type ScrawlixReveal,
  type ScrawlixRevealScope,
} from '@scrawlix/react';
import { useMemo, useState } from 'react';
import './xray.css';

const XRAY_TEXT = 'motherfucker';

function CoverageDiagram({
  segments,
}: {
  segments: readonly ScrawlixLocatedSegment[];
}) {
  return (
    <>
      {segments.map(segment =>
        segment.covered ? (
          <mark key={`${segment.start}-${segment.end}`}>{segment.text}</mark>
        ) : (
          <span key={`${segment.start}-${segment.end}`}>{segment.text}</span>
        )
      )}
    </>
  );
}

export function XrayLab({
  appearance,
  coverage,
  coverageLabel,
  reveal,
  revealScope,
}: {
  appearance: ScrawlixAppearance;
  coverage: CoverageSelector;
  coverageLabel: string;
  reveal: ScrawlixReveal;
  revealScope: ScrawlixRevealScope;
}) {
  const [expanded, setExpanded] = useState(true);
  const engine = useMemo(
    () => createScrawlix({ rules: englishStrongProfanityRules, coverage }),
    [coverage]
  );
  const match = engine.findWithIdentity(XRAY_TEXT)[0];
  const segments = engine.segmentWithOffsets(XRAY_TEXT);

  if (!match) return null;

  const covered = segments.filter(segment => segment.covered);
  const targetStart = match.targetStart - match.start;
  const targetEnd = match.targetEnd - match.start;

  return (
    <section className="xray-section" aria-labelledby="xray-title" data-xray-lab>
      <div className="xray-heading">
        <div>
          <p className="eyebrow">02a / x-ray</p>
          <h2 id="xray-title">See the cut before the ink.</h2>
          <p className="xray-sequence" aria-label="Match to target to cover to output">
            MATCH → TARGET → COVER → OUTPUT
          </p>
        </div>
        <button
          aria-controls="xray-grid"
          aria-expanded={expanded}
          className={expanded ? 'xray-toggle is-active' : 'xray-toggle'}
          onClick={() => setExpanded(value => !value)}
          type="button"
        >
          x-ray {expanded ? 'on' : 'off'}
        </button>
      </div>

      {expanded && (
        <div className="xray-grid" id="xray-grid">
          <article className="xray-card" data-xray-stage="match">
            <span className="xray-label">01 / match</span>
            <div className="xray-value">{match.text}</div>
            <small>
              {match.matchId} · {match.start}–{match.end} · {match.ruleId}
            </small>
          </article>

          <article className="xray-card" data-xray-stage="target">
            <span className="xray-label">02 / target</span>
            <div className="xray-value xray-target">
              <span>{match.text.slice(0, targetStart)}</span>
              <mark>{match.targetText}</mark>
              <span>{match.text.slice(targetEnd)}</span>
            </div>
            <small>
              semantic core · {match.targetStart}–{match.targetEnd}
            </small>
          </article>

          <article className="xray-card" data-xray-stage="cover">
            <span className="xray-label">03 / cover</span>
            <div className="xray-value xray-coverage">
              <CoverageDiagram segments={segments} />
            </div>
            <small>
              {coverageLabel} ·{' '}
              {covered
                .map(segment => `${segment.start}–${segment.end}`)
                .join(', ') || 'none'}
            </small>
          </article>

          <article className="xray-card xray-output" data-xray-stage="output">
            <span className="xray-label">04 / output</span>
            <div className="xray-value">
              <CensoredText
                appearance={appearance}
                coverage={coverage}
                reveal={reveal}
                revealScope={revealScope}
                rules={englishStrongProfanityRules}
                text={XRAY_TEXT}
                title="X-ray output"
              />
            </div>
            <small>
              {appearance} · {reveal}/{revealScope}
            </small>
          </article>
        </div>
      )}
    </section>
  );
}
