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
