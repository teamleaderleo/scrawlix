import type {
  DomCoveredRange,
  DomRangeScanner,
} from '@scrawlix/dom/scan';

const SHOW_TEXT = 4;
const TEXT_NODE = 3;

export type DomRangeIndex = {
  /** Establish the first complete snapshot. */
  initialize(): readonly DomCoveredRange[];
  /** Apply one delivered MutationObserver batch using final page state. */
  update(records: readonly MutationRecord[]): readonly DomCoveredRange[];
  /** Current covered ranges. */
  ranges(): readonly DomCoveredRange[];
  clear(): void;
};

function textNodesWithin(node: Node): Text[] {
  if (node.nodeType === TEXT_NODE) return [node as Text];

  const document = node.ownerDocument;
  if (!document) return [];
  const walker = document.createTreeWalker(node, SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

function topLevelConnectedCandidates(
  root: Node,
  candidates: ReadonlySet<Node>
): Node[] {
  const result: Node[] = [];

  for (const candidate of candidates) {
    if (!root.contains(candidate)) continue;

    let parent = candidate.parentNode;
    let nested = false;
    while (parent && parent !== root) {
      if (candidates.has(parent)) {
        nested = true;
        break;
      }
      parent = parent.parentNode;
    }

    if (!nested) result.push(candidate);
  }

  return result;
}

export function createDomRangeIndex(
  root: Node,
  scanner: DomRangeScanner
): DomRangeIndex {
  const bySource = new Map<Text, DomCoveredRange[]>();

  function removeWithin(node: Node) {
    for (const source of textNodesWithin(node)) {
      bySource.delete(source);
    }
  }

  function addScanned(node: Node) {
    // Replacing a moved/changed subtree must also forget sources that became
    // safe or moved under an exclusion in their final page location.
    removeWithin(node);

    const grouped = new Map<Text, DomCoveredRange[]>();
    for (const range of scanner.scan(node)) {
      const sourceRanges = grouped.get(range.source) ?? [];
      sourceRanges.push(range);
      grouped.set(range.source, sourceRanges);
    }

    for (const [source, sourceRanges] of grouped) {
      bySource.set(source, sourceRanges);
    }
  }

  function snapshot() {
    return Array.from(bySource.values()).flat();
  }

  return {
    initialize() {
      bySource.clear();
      addScanned(root);
      return snapshot();
    },
    update(records) {
      const candidates = new Set<Node>();

      // Removal is applied first. Same-batch moves/reinsertions are scanned from
      // their final location in the candidate phase below.
      for (const record of records) {
        if (record.type === 'characterData') {
          candidates.add(record.target);
          continue;
        }
        if (record.type !== 'childList') continue;

        for (const removed of Array.from(record.removedNodes)) {
          removeWithin(removed);
        }
        for (const added of Array.from(record.addedNodes)) {
          candidates.add(added);
        }
      }

      for (const candidate of topLevelConnectedCandidates(root, candidates)) {
        addScanned(candidate);
      }

      return snapshot();
    },
    ranges: snapshot,
    clear() {
      bySource.clear();
    },
  };
}
