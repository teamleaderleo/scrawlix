import path from 'node:path';

export function parseRankedLexicon(value) {
  const entries = [];

  for (const rawLine of value.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const [textField, frequencyField, ...extra] = rawLine.split('\t');
    const text = textField?.trim();
    if (!text) continue;
    if (extra.length > 0) {
      throw new Error(
        `Lexicon line ${JSON.stringify(rawLine)} has more than two tab-separated fields.`
      );
    }

    let frequency;
    if (frequencyField !== undefined && frequencyField.trim() !== '') {
      frequency = Number(frequencyField.trim());
      if (!Number.isFinite(frequency) || frequency < 0) {
        throw new Error(
          `Lexicon frequency must be a non-negative number: ${JSON.stringify(rawLine)}`
        );
      }
    }

    entries.push({
      rank: entries.length + 1,
      text,
      ...(frequency === undefined ? {} : { frequency }),
    });
  }

  return entries;
}

function matchSnapshot(match) {
  return {
    ruleId: match.ruleId,
    ...(match.packId ? { packId: match.packId } : {}),
    ...(match.profile ? { profile: match.profile } : {}),
    text: match.text,
    start: match.start,
    end: match.end,
    targetText: match.targetText,
    targetStart: match.targetStart,
    targetEnd: match.targetEnd,
  };
}

export function mineFalsePositiveCandidates(
  entries,
  engine,
  { profile, limit = Number.POSITIVE_INFINITY } = {}
) {
  if (!profile) throw new Error('A mining profile name is required.');
  if (!(Number.isInteger(limit) && limit >= 1) && limit !== Number.POSITIVE_INFINITY) {
    throw new Error('Mining limit must be a positive integer.');
  }

  const candidates = [];

  for (const entry of entries) {
    const matches = engine.find(entry.text);
    if (matches.length === 0) continue;

    candidates.push({
      rank: entry.rank,
      text: entry.text,
      ...(entry.frequency === undefined ? {} : { frequency: entry.frequency }),
      profile,
      reviewStatus: 'unreviewed',
      matches: matches.map(matchSnapshot),
    });

    if (candidates.length >= limit) break;
  }

  return candidates;
}

export function miningReport({ adapterId, profile, lexicon, candidates }) {
  return {
    schemaVersion: 1,
    generatedBy: 'scrawlix corpus:mine',
    adapterId,
    profile,
    lexicon,
    candidateCount: candidates.length,
    reviewRequired: true,
    candidates,
  };
}

export function isCorpusDataPath(root, outputPath) {
  const relative = path
    .relative(root, path.resolve(root, outputPath))
    .replaceAll('\\', '/');
  return /(^|\/)packages\/[^/]+\/src\/corpus-data(?:\/|$)/u.test(relative);
}

export function formatMiningReport(report) {
  const lines = [
    `False-positive mining: ${report.adapterId}/${report.profile}`,
    `Lexicon: ${report.lexicon}`,
    `${report.candidateCount} candidate${report.candidateCount === 1 ? '' : 's'} require human review.`,
  ];

  for (const candidate of report.candidates) {
    const frequency =
      candidate.frequency === undefined ? '' : ` frequency=${candidate.frequency}`;
    lines.push(`- #${candidate.rank} ${JSON.stringify(candidate.text)}${frequency}`);
    for (const match of candidate.matches) {
      lines.push(
        `  ${match.ruleId} ${JSON.stringify(match.text)} -> ${JSON.stringify(match.targetText)} [${match.start},${match.end})/[${match.targetStart},${match.targetEnd})`
      );
    }
  }

  if (report.candidateCount > 0) {
    lines.push(
      'Review candidates manually before adding any clean regression case. Mining output is never promoted automatically.'
    );
  }

  return lines.join('\n');
}
