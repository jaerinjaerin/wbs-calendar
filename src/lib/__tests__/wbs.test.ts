import { describe, it, expect } from 'vitest';
import { buildTree } from '../wbs';
import type { WbsNode } from '@/types';

const nodes: WbsNode[] = [
  { id: 'a', project_id: 'p1', parent_id: null, name: '1. 분석', sort_order: 1, color: '#3563e9', depth: 0 },
  { id: 'b', project_id: 'p1', parent_id: null, name: '2. 설계', sort_order: 2, color: '#1a9e8f', depth: 0 },
  { id: 'c', project_id: 'p1', parent_id: 'a', name: '1.1 요구사항', sort_order: 1, color: '#3563e9', depth: 1 },
  { id: 'd', project_id: 'p1', parent_id: 'a', name: '1.2 현행분석', sort_order: 2, color: '#3563e9', depth: 1 },
  { id: 'e', project_id: 'p1', parent_id: 'c', name: '1.1.1 인터뷰', sort_order: 1, color: '#3563e9', depth: 2 },
];

const taskCounts: Record<string, number> = { c: 2, d: 1, e: 1 };

describe('buildTree', () => {
  it('builds correct hierarchy', () => {
    const tree = buildTree(nodes, taskCounts);
    expect(tree).toHaveLength(2);
    expect(tree[0].name).toBe('1. 분석');
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].name).toBe('1.1 요구사항');
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].name).toBe('1.1.1 인터뷰');
  });

  it('sorts by sort_order', () => {
    const tree = buildTree(nodes, taskCounts);
    expect(tree[0].name).toBe('1. 분석');
    expect(tree[1].name).toBe('2. 설계');
  });

  it('aggregates task counts up the tree', () => {
    const tree = buildTree(nodes, taskCounts);
    expect(tree[0].task_count).toBe(4);
    expect(tree[0].children[0].task_count).toBe(3);
    expect(tree[0].children[0].children[0].task_count).toBe(1);
    expect(tree[0].children[1].task_count).toBe(1);
    expect(tree[1].task_count).toBe(0);
  });

  it('returns empty array for empty input', () => {
    expect(buildTree([], {})).toEqual([]);
  });
});
