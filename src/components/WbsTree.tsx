'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { buildTree } from '@/lib/wbs';
import type { WbsTreeNode } from '@/types';

const COLOR_PRESETS = ['#3563e9', '#1a9e8f', '#7c5cbf', '#d97520', '#c74060', '#e05297', '#2d8a4e', '#8b6914'];

interface AddingState {
  parentId: string | null;
  depth: number;
}

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
  const [adding, setAdding] = useState<AddingState | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLOR_PRESETS[0]);
  const nameInputRef = useRef<HTMLInputElement>(null);

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

  function findNode(nodes: WbsTreeNode[], id: string): WbsTreeNode | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      const found = findNode(n.children, id);
      if (found) return found;
    }
    return null;
  }

  function openAddPopup(parentId: string | null, depth: number) {
    setAdding({ parentId, depth });
    setNewName('');
    setNewColor(parentId ? (findNode(tree, parentId)?.color ?? COLOR_PRESETS[0]) : COLOR_PRESETS[0]);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }

  async function confirmAdd() {
    if (!adding || !newName.trim()) return;
    const { parentId, depth } = adding;
    const siblings = parentId
      ? tree.flatMap(function findChildren(n): WbsTreeNode[] {
          if (n.id === parentId) return n.children;
          return n.children.flatMap(findChildren);
        })
      : tree;
    const sortOrder = siblings.length + 1;
    // ponytail: child nodes inherit parent color, root nodes use user-picked color
    const color = parentId ? (findNode(tree, parentId)?.color ?? newColor) : newColor;

    await supabase.from('wbs_nodes').insert({
      project_id: projectId,
      parent_id: parentId,
      name: newName.trim(),
      sort_order: sortOrder,
      color,
      depth,
    });
    setAdding(null);
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

  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function confirmDelete() {
    if (!deletingId) return;
    await supabase.from('wbs_nodes').delete().eq('id', deletingId);
    if (selectedNodeId === deletingId) onSelectNode(null);
    setDeletingId(null);
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
            onClick={(e) => { e.stopPropagation(); openAddPopup(node.id, node.depth + 1); }}
            disabled={!!adding}
          >
            +
          </button>
          <button
            className="opacity-0 group-hover:opacity-100 border-none bg-transparent cursor-pointer text-sm text-error px-0.5"
            title="삭제"
            onClick={(e) => { e.stopPropagation(); setDeletingId(node.id); }}
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
        <button className="w-[22px] h-[22px] rounded-xs border border-hairline bg-transparent cursor-pointer text-sm flex items-center justify-center" onClick={() => openAddPopup(null, 0)} disabled={!!adding}>+</button>
      </div>
      <div className="flex-1 overflow-y-auto py-xs">
        {tree.map(renderNode)}
      </div>
      {adding && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]" onClick={() => setAdding(null)}>
          <div className="bg-canvas rounded-lg p-lg flex flex-col gap-sm w-[320px] shadow-lg" onClick={(e) => e.stopPropagation()}>
            <span className="text-[15px] font-semibold text-ink">
              {adding.parentId ? '하위 항목 추가' : '카테고리 추가'}
            </span>
            <input
              ref={nameInputRef}
              className="w-full text-[13px] border border-hairline rounded-md py-2 px-sm outline-none focus:border-ink"
              placeholder="이름 입력"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') setAdding(null); }}
            />
            {!adding.parentId && (
              <div>
                <span className="text-[12px] text-muted mb-xxs block">색상</span>
                <div className="flex gap-xs flex-wrap">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      className={`w-7 h-7 rounded-full border-2 cursor-pointer ${newColor === c ? 'border-ink' : 'border-transparent'}`}
                      style={{ background: c }}
                      onClick={() => setNewColor(c)}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-xs justify-end mt-xs">
              <button
                className="text-[13px] px-md py-[7px] rounded-md border border-hairline bg-transparent cursor-pointer text-muted"
                onClick={() => setAdding(null)}
              >
                취소
              </button>
              <button
                className="text-[13px] px-md py-[7px] rounded-md bg-primary text-on-primary cursor-pointer border-none disabled:opacity-40"
                onClick={confirmAdd}
                disabled={!newName.trim()}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
      {deletingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]" onClick={() => setDeletingId(null)}>
          <div className="bg-canvas rounded-lg p-lg flex flex-col gap-sm w-[300px] shadow-lg" onClick={(e) => e.stopPropagation()}>
            <span className="text-[15px] font-semibold text-ink">항목 삭제</span>
            <p className="text-[13px] text-muted m-0">이 항목과 하위 항목이 모두 삭제됩니다. 계속하시겠습니까?</p>
            <div className="flex gap-xs justify-end mt-xs">
              <button
                className="text-[13px] px-md py-[7px] rounded-md border border-hairline bg-transparent cursor-pointer text-muted"
                onClick={() => setDeletingId(null)}
              >
                취소
              </button>
              <button
                className="text-[13px] px-md py-[7px] rounded-md bg-error text-on-primary cursor-pointer border-none"
                onClick={confirmDelete}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
