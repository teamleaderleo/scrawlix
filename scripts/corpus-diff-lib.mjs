const stableJson = value => JSON.stringify(value);

function matchSnapshot(matches) {
  return matches.map(match => ({
    ruleId: match.ruleId,
    ...(match.packId === undefined ? {} : { packId: match.packId }),
    ...(match.entryId === undefined ? {} : { entryId: match.entryId }),
    text: match.text,
    start: match.start,
    end: match.end,
    targetText: match.targetText,
    targetStart: match.targetStart,
    targetEnd: match.targetEnd,
  }));
}

function targetSnapshot(matches) {
  return matches.map(match => ({
    ruleId: match.ruleId,
    ...(match.packId === undefined ? {} : { packId: match.packId }),
    ...(match.entryId === undefined ? {} : { entryId: match.entryId }),
    targetText: match.targetText,
    targetStart: match.targetStart,
    targetEnd: match.targetEnd,
  }));
}

function metadataSnapshot(corpusCase) {
  return {
    text: corpusCase.text,
    profile: corpusCase.profile,
    tags: corpusCase.tags ?? [],
    ...(corpusCase.note === undefined ? {} : { note: corpusCase.note }),
    ...(corpusCase.provenance === undefined
      ? {}
      : { provenance: corpusCase.provenance }),
  };
}

function summarizedCase(record) {
  if (!record) return null;
  return {
    packageName: record.packageName,
    file: record.file,
    id: record.corpusCase.id,
    profile: record.corpusCase.profile,
    text: record.corpusCase.text,
    matches: matchSnapshot(record.corpusCase.matches),
  };
}

export function indexCorpusDocuments(documents) {
  const indexed = new Map();

  for (const document of documents) {
    for (const corpusCase of document.cases) {
      const key = `${document.packageName}:${corpusCase.id}`;
      if (indexed.has(key)) {
        throw new Error(`Duplicate corpus case key while diffing: ${key}`);
      }
      indexed.set(key, {
        packageName: document.packageName,
        file: document.file,
        corpusCase,
      });
    }
  }

  return indexed;
}

export function diffCorpusDocuments(baseDocuments, headDocuments) {
  const base = indexCorpusDocuments(baseDocuments);
  const head = indexCorpusDocuments(headDocuments);
  const keys = [...new Set([...base.keys(), ...head.keys()])].sort();
  const diff = {
    newlyMatching: [],
    newlyClean: [],
    changedTarget: [],
    changedMatch: [],
    addedClean: [],
    removed: [],
    metadataOnly: [],
  };

  for (const key of keys) {
    const before = base.get(key);
    const after = head.get(key);

    if (!before && after) {
      const item = { key, before: null, after: summarizedCase(after) };
      if (after.corpusCase.matches.length > 0) diff.newlyMatching.push(item);
      else diff.addedClean.push(item);
      continue;
    }

    if (before && !after) {
      diff.removed.push({ key, before: summarizedCase(before), after: null });
      continue;
    }

    const beforeCase = before.corpusCase;
    const afterCase = after.corpusCase;
    const beforeMatches = matchSnapshot(beforeCase.matches);
    const afterMatches = matchSnapshot(afterCase.matches);
    const beforeHasMatches = beforeMatches.length > 0;
    const afterHasMatches = afterMatches.length > 0;
    const item = {
      key,
      before: summarizedCase(before),
      after: summarizedCase(after),
    };

    if (!beforeHasMatches && afterHasMatches) {
      diff.newlyMatching.push(item);
      continue;
    }
    if (beforeHasMatches && !afterHasMatches) {
      diff.newlyClean.push(item);
      continue;
    }

    if (stableJson(beforeMatches) !== stableJson(afterMatches)) {
      if (
        stableJson(targetSnapshot(beforeCase.matches)) !==
        stableJson(targetSnapshot(afterCase.matches))
      ) {
        diff.changedTarget.push(item);
      } else {
        diff.changedMatch.push(item);
      }
      continue;
    }

    if (
      stableJson(metadataSnapshot(beforeCase)) !==
      stableJson(metadataSnapshot(afterCase)) ||
      before.file !== after.file
    ) {
      diff.metadataOnly.push(item);
    }
  }

  return diff;
}

export function corpusDiffCount(diff) {
  return Object.values(diff).reduce((count, items) => count + items.length, 0);
}

const sectionDefinitions = [
  ['newlyMatching', 'Newly matching'],
  ['newlyClean', 'Newly clean'],
  ['changedTarget', 'Changed semantic target'],
  ['changedMatch', 'Changed full match'],
  ['addedClean', 'Added clean regression'],
  ['removed', 'Removed corpus case'],
  ['metadataOnly', 'Metadata-only change'],
];

function describeSide(side) {
  if (!side) return '∅';
  const matches = side.matches.length === 0
    ? 'clean'
    : side.matches
        .map(match =>
          `${match.ruleId}:${JSON.stringify(match.text)}→${JSON.stringify(match.targetText)}@[${match.start},${match.end})/[${match.targetStart},${match.targetEnd})`
        )
        .join(', ');
  return `${side.profile} ${JSON.stringify(side.text)} (${matches})`;
}

export function formatCorpusDiff(diff, { baseLabel = 'base', headLabel = 'head' } = {}) {
  const total = corpusDiffCount(diff);
  const lines = [`Corpus diff: ${baseLabel} → ${headLabel}`, `${total} changed case${total === 1 ? '' : 's'}.`];

  if (total === 0) return lines.join('\n');

  for (const [key, title] of sectionDefinitions) {
    const items = diff[key];
    if (items.length === 0) continue;
    lines.push('', `${title} (${items.length})`);
    for (const item of items) {
      lines.push(`- ${item.key}`);
      lines.push(`  ${baseLabel}: ${describeSide(item.before)}`);
      lines.push(`  ${headLabel}: ${describeSide(item.after)}`);
    }
  }

  return lines.join('\n');
}
