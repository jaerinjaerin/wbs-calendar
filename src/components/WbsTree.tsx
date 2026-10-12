'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { loadWbsTree, createWbsNode, renameWbsNode, deleteWbsNode } from '@/app/actions';
import { errorMessage } from '@/lib/actionResult';
import { buildTree } from '@/lib/wbs';
import type { WbsTreeNode } from '@/types';
import { useToast } from '@/components/Toast';
import { inputCls, primaryBtn, secondaryBtn, dangerBtn, modalOverlay, modalCard } from '@/lib/styles';
import { COLOR_PRESETS } from '@/lib/color';

interface AddingState {
  parentId: string | null;
  depth: number;
}

interface WbsTreeProps {
  projectId: string;
  hiddenIds: Set<string>;
  onToggleNode: (id: string) => void;
  onDataChange?: () => void;
}

export default function WbsTree({ projectId, hiddenIds, onToggleNode, onDataChange }: WbsTreeProps) {
  const [tree, setTree] = useState<WbsTreeNode[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [adding, setAdding] = useState<AddingState | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLOR_PRESETS[0]);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { showToast, toastNode } = useToast();

  const loadTree = useCallback(async () => {
    const { data, error } = await loadWbsTree(projectId);
    if (!data) {
      console.error(error);
      showToast({ message: errorMessage(error, '분류를 불러오지 못했습니다') });
      return;
    }
    setTree(buildTree(data.nodes, data.counts));
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

    // close first so repeat clicks/Enter can't insert duplicates
    setAdding(null);
    const { error } = await createWbsNode({
      project_id: projectId,
      parent_id: parentId,
      name: newName.trim(),
      sort_order: sortOrder,
      color,
      depth,
    });
    if (error) {
      console.error(error);
      showToast({ message: errorMessage(error, '분류 추가에 실패했습니다') });
    }
    if (parentId) setCollapsed((prev) => { const next = new Set(prev); next.delete(parentId); return next; });
    await loadTree();
    onDataChange?.();
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return;
    const { error } = await renameWbsNode(id, editName);
    if (error) {
      console.error(error);
      showToast({ message: errorMessage(error, '분류 이름 변경에 실패했습니다') });
    }
    setEditingId(null);
    await loadTree();
    onDataChange?.();
  }

  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function confirmDelete() {
    if (!deletingId) return;
    const { error } = await deleteWbsNode(deletingId);
    if (error) {
      console.error(error);
      showToast({ message: errorMessage(error, '분류 삭제에 실패했습니다') });
    }
    setDeletingId(null);
    await loadTree();
    onDataChange?.();
  }

  function renderNode(node: WbsTreeNode) {
    const isCollapsed = collapsed.has(node.id);
    const hasChildren = node.children.length > 0;
    const isChecked = !hiddenIds.has(node.id);
    const indent = node.depth * 20;

    return (
      <div key={node.id}>
        <div
          className="group flex items-center gap-xs py-1.5 pr-md text-body-xs cursor-pointer relative hover:bg-surface-card"
          style={{ paddingLeft: 16 + indent }}
          onClick={() => onToggleNode(node.id)}
        >
          <span
            className={`w-4 h-4 flex items-center justify-center text-micro text-muted-soft shrink-0 transition-transform duration-150 ${!hasChildren ? 'invisible' : ''} ${isCollapsed ? '-rotate-90' : ''}`}
            onClick={(e) => { e.stopPropagation(); toggleCollapse(node.id); }}
          >
            ▾
          </span>
          <span
            role="checkbox"
            aria-checked={isChecked}
            className="w-4 h-4 rounded-xs shrink-0 border-2 flex items-center justify-center text-on-primary text-micro font-bold leading-none"
            style={{ borderColor: node.color, background: isChecked ? node.color : 'transparent' }}
          >
            {isChecked && '✓'}
          </span>
          {editingId === node.id ? (
            <input
              className="flex-1 text-body-xs border border-accent rounded-xs py-px px-xxs outline-none"
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
          <span className="font-mono text-micro text-muted-soft bg-surface-card px-1.5 rounded-pill">{node.task_count}</span>
          <button
            className="opacity-0 group-hover:opacity-100 border-none bg-transparent cursor-pointer text-body-sm text-muted-soft px-0.5"
            title="하위 분류 추가"
            onClick={(e) => { e.stopPropagation(); openAddPopup(node.id, node.depth + 1); }}
            disabled={!!adding}
          >
            +
          </button>
          <button
            className="opacity-0 group-hover:opacity-100 border-none bg-transparent cursor-pointer text-body-sm text-error px-0.5"
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
        <span className="text-body-xs font-semibold uppercase tracking-wider text-muted-soft">WBS</span>
        <button className="w-[22px] h-[22px] rounded-xs border border-hairline bg-transparent cursor-pointer text-body-sm flex items-center justify-center" onClick={() => openAddPopup(null, 0)} aria-label="분류 추가" title="분류 추가" disabled={!!adding}>+</button>
      </div>
      <div className="flex-1 overflow-y-auto py-xs">
        {tree.map(renderNode)}
      </div>
      {adding && (
        <div className={modalOverlay} onClick={() => setAdding(null)}>
          <div className={`${modalCard} flex flex-col gap-sm`} onClick={(e) => e.stopPropagation()}>
            <span className="text-title-sm text-ink">
              {adding.parentId ? '하위 분류 추가' : '분류 추가'}
            </span>
            <input
              ref={nameInputRef}
              className={inputCls}
              placeholder="이름 입력"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) confirmAdd(); if (e.key === 'Escape') setAdding(null); }}
            />
            {!adding.parentId && (
              <div>
                <span className="text-body-xs text-muted mb-xxs block">색상</span>
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
                className={secondaryBtn}
                onClick={() => setAdding(null)}
              >
                취소
              </button>
              <button
                className={primaryBtn}
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
        <div className={modalOverlay} onClick={() => setDeletingId(null)}>
          <div className={`${modalCard} flex flex-col gap-sm`} onClick={(e) => e.stopPropagation()}>
            <span className="text-title-sm text-ink">분류 삭제</span>
            <p className="text-body-sm text-muted m-0">이 분류와 하위 분류가 모두 삭제됩니다. 계속하시겠습니까?</p>
            <div className="flex gap-xs justify-end mt-xs">
              <button
                className={secondaryBtn}
                onClick={() => setDeletingId(null)}
              >
                취소
              </button>
              <button
                className={dangerBtn}
                onClick={confirmDelete}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
      {toastNode}
    </aside>
  );
}
