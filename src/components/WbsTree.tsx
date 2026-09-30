'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { buildTree } from '@/lib/wbs';
import type { WbsTreeNode } from '@/types';

interface WbsTreeProps {
  projectId: string;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onDataChange?: () => void;
}

export default function WbsTree({ projectId, selectedNodeId, onSelectNode, onDataChange }: WbsTreeProps) {
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
    onDataChange?.();
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return;
    await supabase.from('wbs_nodes').update({ name: editName }).eq('id', id);
    setEditingId(null);
    await loadTree();
    onDataChange?.();
  }

  async function handleDelete(id: string) {
    await supabase.from('wbs_nodes').delete().eq('id', id);
    if (selectedNodeId === id) onSelectNode(null);
    await loadTree();
    onDataChange?.();
  }

  function renderNode(node: WbsTreeNode) {
    const isCollapsed = collapsed.has(node.id);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedNodeId === node.id;
    const indent = node.depth * 20;

    return (
      <div key={node.id}>
        <div
          className={`group flex items-center gap-xxs py-1.5 pr-md text-[13px] cursor-pointer relative hover:bg-surface-card ${isSelected ? 'bg-surface-soft text-accent' : ''}`}
          style={{ paddingLeft: 16 + indent }}
          onClick={() => onSelectNode(isSelected ? null : node.id)}
        >
          <span
            className={`w-4 h-4 flex items-center justify-center text-[10px] text-muted-soft shrink-0 transition-transform duration-150 ${!hasChildren ? 'invisible' : ''} ${isCollapsed ? '-rotate-90' : ''}`}
            onClick={(e) => { e.stopPropagation(); toggleCollapse(node.id); }}
          >
            ▾
          </span>
          <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: node.color }} />
          {editingId === node.id ? (
            <input
              className="flex-1 text-[13px] border border-accent rounded-[3px] py-[1px] px-xxs outline-none"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => handleRename(node.id)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename(node.id)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span
              className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
              onDoubleClick={(e) => { e.stopPropagation(); setEditingId(node.id); setEditName(node.name); }}
            >
              {node.name}
            </span>
          )}
          <span className="font-mono text-[11px] text-muted-soft bg-surface-card px-1.5 rounded-pill">{node.task_count}</span>
          <button
            className="opacity-0 group-hover:opacity-100 border-none bg-transparent cursor-pointer text-sm text-muted-soft px-0.5"
            title="하위 항목 추가"
            onClick={(e) => { e.stopPropagation(); handleAddNode(node.id, node.depth + 1); }}
          >
            +
          </button>
          <button
            className="opacity-0 group-hover:opacity-100 border-none bg-transparent cursor-pointer text-sm text-error px-0.5"
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
    <aside className="w-[280px] bg-canvas border-r border-hairline flex flex-col overflow-hidden shrink-0">
      <div className="p-md flex items-center justify-between border-b border-hairline-soft">
        <span className="text-xs font-semibold uppercase tracking-[0.8px] text-muted-soft">WBS 구조</span>
        <button className="w-[22px] h-[22px] rounded-xs border border-hairline bg-transparent cursor-pointer text-sm flex items-center justify-center" onClick={() => handleAddNode(null, 0)}>+</button>
      </div>
      <div className="flex-1 overflow-y-auto py-xs">
        {tree.map(renderNode)}
      </div>
    </aside>
  );
}
