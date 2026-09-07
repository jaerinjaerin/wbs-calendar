'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { buildTree } from '@/lib/wbs';
import type { WbsTreeNode } from '@/types';
import styles from './WbsTree.module.css';

interface WbsTreeProps {
  projectId: string;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}

export default function WbsTree({ projectId, selectedNodeId, onSelectNode }: WbsTreeProps) {
  const [tree, setTree] = useState<WbsTreeNode[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const loadTree = useCallback(async () => {
    const [{ data: nodes }, { data: counts }] = await Promise.all([
      supabase.from('wbs_nodes').select('*').eq('project_id', projectId).order('sort_order'),
      supabase.from('tasks').select('wbs_node_id').then(({ data }) => {
        const map: Record<string, number> = {};
        data?.forEach((t) => { map[t.wbs_node_id] = (map[t.wbs_node_id] ?? 0) + 1; });
        return { data: map };
      }),
    ]);
    if (nodes) setTree(buildTree(nodes, counts ?? {}));
  }, [projectId]);

  useEffect(() => { loadTree(); }, [loadTree]);

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleAddNode(parentId: string | null, depth: number) {
    const siblings = parentId
      ? tree.flatMap(function findChildren(n): WbsTreeNode[] {
          if (n.id === parentId) return n.children;
          return n.children.flatMap(findChildren);
        })
      : tree;
    const sortOrder = siblings.length + 1;

    await supabase.from('wbs_nodes').insert({
      project_id: projectId,
      parent_id: parentId,
      name: '새 항목',
      sort_order: sortOrder,
      color: parentId ? '#3563e9' : ['#3563e9', '#1a9e8f', '#7c5cbf', '#d97520', '#c74060'][tree.length % 5],
      depth,
    });
    await loadTree();
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return;
    await supabase.from('wbs_nodes').update({ name: editName }).eq('id', id);
    setEditingId(null);
    await loadTree();
  }

  async function handleDelete(id: string) {
    await supabase.from('wbs_nodes').delete().eq('id', id);
    if (selectedNodeId === id) onSelectNode(null);
    await loadTree();
  }

  function renderNode(node: WbsTreeNode) {
    const isCollapsed = collapsed.has(node.id);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedNodeId === node.id;
    const indent = node.depth * 20;

    return (
      <div key={node.id}>
        <div
          className={`${styles.item} ${isSelected ? styles.active : ''}`}
          style={{ paddingLeft: 16 + indent }}
          onClick={() => onSelectNode(isSelected ? null : node.id)}
        >
          <span
            className={`${styles.toggle} ${!hasChildren ? styles.empty : ''} ${isCollapsed ? styles.collapsed : ''}`}
            onClick={(e) => { e.stopPropagation(); toggleCollapse(node.id); }}
          >
            ▾
          </span>
          <span className={styles.dot} style={{ background: node.color }} />
          {editingId === node.id ? (
            <input
              className={styles.editInput}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => handleRename(node.id)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename(node.id)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span
              className={styles.label}
              onDoubleClick={(e) => { e.stopPropagation(); setEditingId(node.id); setEditName(node.name); }}
            >
              {node.name}
            </span>
          )}
          <span className={styles.count}>{node.task_count}</span>
          <button
            className={styles.addBtn}
            title="하위 항목 추가"
            onClick={(e) => { e.stopPropagation(); handleAddNode(node.id, node.depth + 1); }}
          >
            +
          </button>
          <button
            className={styles.delBtn}
            title="삭제"
            onClick={(e) => { e.stopPropagation(); handleDelete(node.id); }}
          >
            ×
          </button>
        </div>
        {hasChildren && !isCollapsed && node.children.map(renderNode)}
      </div>
    );
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.title}>WBS 구조</span>
        <button className={styles.headerAdd} onClick={() => handleAddNode(null, 0)}>+</button>
      </div>
      <div className={styles.tree}>
        {tree.map(renderNode)}
      </div>
    </aside>
  );
}
