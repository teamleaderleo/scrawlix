import { censorRuleFromTerms } from '@scrawlix/core';
import { CensoredText } from '@scrawlix/react';
import { useMemo, useState } from 'react';

const episodeRules = [
  { episode: 2, terms: ['the Glass Orchard'] },
  { episode: 3, terms: ["the Ferryman is Mara's brother"] },
  { episode: 4, terms: ['the red key opens the observatory'] },
  { episode: 5, terms: ['Mara burns the north archive'] },
] as const;

const sampleRecap =
  "The recap says Mara reaches the Glass Orchard, learns the Ferryman is Mara's brother, discovers the red key opens the observatory, and finally Mara burns the north archive.";

const episodes = [1, 2, 3, 4, 5] as const;

export function SpoilerLab() {
  const [watchedThrough, setWatchedThrough] = useState(2);
  const futureRules = episodeRules.filter(rule => rule.episode > watchedThrough);
  const futureTerms = futureRules.flatMap(rule => [...rule.terms]);
  const rules = useMemo(
    () =>
      futureTerms.length > 0
        ? [censorRuleFromTerms('glass-orchard-future-spoilers', futureTerms)]
        : [],
    [futureTerms.join('\u0000')]
  );

  return (
    <section className="spoiler-section" aria-labelledby="spoiler-title">
      <div className="section-heading">
        <p className="eyebrow">05 / progress-aware pack</p>
        <h2 id="spoiler-title">Tell Scrawlix where you stopped watching.</h2>
        <p>
          A fictional pack tags spoiler phrases by episode. Your progress decides
          which rules activate, so yesterday's spoiler becomes today's ordinary text.
        </p>
      </div>

      <div
        className="spoiler-lab"
        data-hidden-count={futureRules.length}
        data-spoiler-lab
        data-watched-through={watchedThrough}
      >
        <aside className="spoiler-pack-card">
          <p className="spoiler-kicker">fictional community pack</p>
          <h3>The Glass Orchard</h3>
          <p className="spoiler-pack-meta">5 episodes · 4 spoiler rules</p>

          <div className="spoiler-episode-list" aria-label="Pack spoiler rules">
            {episodeRules.map(rule => (
              <div
                data-future={rule.episode > watchedThrough ? 'true' : 'false'}
                key={rule.episode}
              >
                <span>episode {rule.episode}</span>
                <strong>
                  {rule.episode > watchedThrough ? 'covered' : 'seen'}
                </strong>
              </div>
            ))}
          </div>
        </aside>

        <div className="spoiler-workbench">
          <div className="spoiler-progress">
            <div>
              <span>watched through</span>
              <strong>episode {watchedThrough}</strong>
            </div>
            <div className="spoiler-progress-buttons" role="group" aria-label="Watched through episode">
              {episodes.map(episode => (
                <button
                  aria-pressed={episode === watchedThrough}
                  className={episode === watchedThrough ? 'is-active' : ''}
                  key={episode}
                  onClick={() => setWatchedThrough(episode)}
                  type="button"
                >
                  {episode}
                </button>
              ))}
            </div>
          </div>

          <div className="spoiler-output">
            <p className="spoiler-output-label">
              recap feed · {futureRules.length} future spoiler{futureRules.length === 1 ? '' : 's'} covered
            </p>
            <div className="spoiler-copy">
              <CensoredText
                appearance="blur"
                coverage="full"
                key={watchedThrough}
                reveal="click"
                rules={rules}
                text={sampleRecap}
                title="Future spoiler"
              />
            </div>
            <p className="spoiler-hint">
              {futureRules.length > 0
                ? 'click the recap to reveal future spoilers'
                : 'caught up — the whole recap is visible'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
