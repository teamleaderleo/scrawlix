export type PendingRootCompactionStats = {
  ancestorVisits: number;
};

/**
 * Keep only queued roots that still belong to the observed subtree and are not
 * already covered by another queued ancestor.
 *
 * Work is proportional to each queued node's ancestor depth instead of the
 * number of other queued roots.
 */
export function compactPendingRoots(
  pending: ReadonlySet<Node>,
  root: Node,
  stats?: PendingRootCompactionStats
): Node[] {
  const queued = [...pending];
  const queuedSet = new Set(queued);
  const compacted: Node[] = [];

  for (const node of queued) {
    if (node === root) {
      compacted.push(node);
      continue;
    }

    let ancestor = node.parentNode;
    let covered = false;
    let withinRoot = false;

    while (ancestor) {
      if (stats) stats.ancestorVisits += 1;

      if (queuedSet.has(ancestor)) {
        covered = true;
        break;
      }

      if (ancestor === root) {
        withinRoot = true;
        break;
      }

      ancestor = ancestor.parentNode;
    }

    if (!covered && withinRoot) compacted.push(node);
  }

  return compacted;
}
