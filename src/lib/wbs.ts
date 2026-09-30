import type { WbsNode, WbsTreeNode } from '@/types';

export function buildTree(
  nodes: WbsNode[],
  taskCounts: Record<string, number>
): WbsTreeNode[] {
  const map = new Map<string, WbsTreeNode>();

  for (const node of nodes) {
    map.set(node.id, { ...node, children: [], task_count: taskCounts[node.id] ?? 0 });
  }

  const roots: WbsTreeNode[] = [];

  const sorted = Array.from(map.values()).sort((a, b) => a.sort_order - b.sort_order);

  for (const node of sorted) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function sumCounts(node: WbsTreeNode): number {
    let total = node.task_count;
    for (const child of node.children) {
      total += sumCounts(child);
    }
    node.task_count = total;
    return total;
  }

  for (const root of roots) {
    sumCounts(root);
  }

  return roots;
}

export function flattenHierarchical(nodes: WbsNode[]): WbsNode[] {
  const byParent = new Map<string | null, WbsNode[]>();
  for (const n of nodes) {
    const key = n.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(n);
  }
  byParent.forEach((list) => {
    list.sort((a: WbsNode, b: WbsNode) => a.sort_order - b.sort_order);
  });
  const result: WbsNode[] = [];
  function walk(parentId: string | null) {
    for (const n of byParent.get(parentId) ?? []) {
      result.push(n);
      walk(n.id);
    }
  }
  walk(null);
  return result;
}
