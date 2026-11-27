'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import type { Task, WbsNode, User, TaskStatus, TaskPriority } from '@/types';
import { flattenHierarchical } from '@/lib/wbs';
import WbsSelect from './WbsSelect';
import BottomSheet from './BottomSheet';
import { useIsMobile } from '@/lib/useIsMobile';
import { groupCls, rowCls, labelCls, fieldCls, selectCls, statusCls, priorityCls } from './TaskPeekPanel';
import { primaryBtn, secondaryBtn, modalOverlay, inputCls } from '@/lib/styles';
import { COLOR_PRESETS } from '@/lib/color';

const smallBtnBase = 'h-7 px-sm rounded-md border text-body-xs font-medium cursor-pointer whitespace-nowrap';
const smallBtn = `${smallBtnBase} border-hairline bg-canvas text-ink`;
const smallPrimaryBtn = `${smallBtnBase} border-primary bg-primary text-on-primary disabled:opacity-40 disabled:cursor-not-allowed`;

interface TaskModalProps {
  wbsNodes: WbsNode[];
  users: User[];
  defaultStart: string | null;
  defaultEnd: string | null;
  onSave: (task: Omit<Task, 'id'>) => void;
  // creates a category (under parentId, or top-level when null) and returns its id; null on failure
  onCreateNode: (name: string, color: string, parentId: string | null) => Promise<string | null>;
  onClose: () => void;
}

// "작업 이름과 분류가 비어 있어요": 과/와 and 이/가 follow whether the previous word ends in a final consonant
const hasBatchim = (w: string) => (w.charCodeAt(w.length - 1) - 0xac00) % 28 !== 0;
function missingMessage(fields: string[]): string {
  const joined = fields.reduce((acc, w, i) =>
    i === 0 ? w : `${acc}${i === fields.length - 1 ? (hasBatchim(fields[i - 1]) ? '과 ' : '와 ') : ', '}${w}`, '');
  return `${joined}${hasBatchim(fields[fields.length - 1]) ? '이' : '가'} 비어 있어요`;
}

export default function TaskModal({ wbsNodes, users, defaultStart, defaultEnd, onSave, onCreateNode, onClose }: TaskModalProps) {
  const mobile = useIsMobile();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(defaultStart ?? '');
  const [endDate, setEndDate] = useState(defaultEnd ?? defaultStart ?? '');
  const [assigneeId, setAssigneeId] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [memo, setMemo] = useState('');
  const [url, setUrl] = useState('');
  const [isMilestone, setIsMilestone] = useState(false);
  const sortedNodes = useMemo(() => flattenHierarchical(wbsNodes), [wbsNodes]);
  const [pickedNodeId, setWbsNodeId] = useState('');
  const wbsNodeId = pickedNodeId || sortedNodes[0]?.id || ''; // nodes may arrive after the modal opens
  const submittedRef = useRef(false); // blocks double-click before the modal unmounts
  const [showErrors, setShowErrors] = useState(false); // only after a blocked submit
  // inline category form: "+ 분류 추가" when there are none, "+ 새 분류" in the dropdown otherwise
  const [nodeForm, setNodeForm] = useState(false);
  const [nodeUnder, setNodeUnder] = useState(false); // false = top-level, true = under the selected category
  const [nodeName, setNodeName] = useState('');
  const [nodeColor, setNodeColor] = useState(COLOR_PRESETS[0]);
  const [creatingNode, setCreatingNode] = useState(false);

  const missing = [!name.trim() && '작업 이름', !wbsNodeId && '분류', (!startDate || !endDate) && '기간'].filter(Boolean) as string[];
  const nameErr = showErrors && !name.trim();
  const nodeErr = showErrors && !wbsNodeId;

  async function createNode() {
    if (creatingNode || !nodeName.trim()) return;
    setCreatingNode(true);
    const parentId = nodeUnder && selectedNode ? selectedNode.id : null;
    const id = await onCreateNode(nodeName.trim(), nodeColor, parentId);
    setCreatingNode(false);
    if (!id) return;
    setWbsNodeId(id);
    setNodeForm(false);
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const selectedNode = wbsNodes.find((n) => n.id === wbsNodeId);
  const color = selectedNode?.color ?? '#ccc';

  function openNodeForm() {
    setNodeForm(true);
    setNodeName('');
    setNodeUnder(false);
  }

  function changeStart(start: string) {
    setStartDate(start);
    if (start && endDate < start) setEndDate(start);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittedRef.current) return;
    if (missing.length > 0) { setShowErrors(true); return; }
    submittedRef.current = true;
    onSave({
      name: name.trim(),
      start_date: startDate,
      end_date: endDate,
      assignee_id: assigneeId || null,
      status,
      priority: priority || null,
      memo: memo.trim() || null,
      url: url.trim() || null,
      wbs_node_id: wbsNodeId,
      is_milestone: isMilestone,
    });
  }

  const fields = (
    <>
        {/* title + period */}
        <div className={`${groupCls} flex gap-sm`}>
          <span className="w-1 rounded-xs my-xs shrink-0" style={{ background: color }} />
          <div className="flex-1 min-w-0 flex flex-col pb-xxs">
            <input
              className={`${fieldCls} text-body-md font-semibold text-ink py-xs px-xxs w-full ${nameErr ? 'placeholder:text-error' : 'placeholder:text-muted-soft'}`}
              placeholder="새로운 작업"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={nameErr}
              autoFocus={!mobile}
            />
            <label className={`${rowCls} cursor-pointer`}>
              <span className={labelCls}>주요일정</span>
              <input type="checkbox" className="ml-auto mr-xxs accent-ink cursor-pointer" checked={isMilestone} onChange={(e) => setIsMilestone(e.target.checked)} />
            </label>
            <div className={rowCls}>
              <span className={labelCls}>시작</span>
              <input type="date" className={`${fieldCls} ml-auto text-body-xs px-xxs`} value={startDate} onChange={(e) => changeStart(e.target.value)} />
            </div>
            <div className={rowCls}>
              <span className={labelCls}>종료</span>
              <input type="date" className={`${fieldCls} ml-auto text-body-xs px-xxs`} value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>

        {/* attributes */}
        <div className={groupCls}>
          {nodeForm ? (
            <div className="flex flex-col gap-xs py-sm">
              <span className={labelCls}>새 분류</span>
              {selectedNode && (
                <div role="radiogroup" aria-label="새 분류 위치" className="flex rounded-md border border-hairline overflow-hidden text-body-xs">
                  {[false, true].map((under) => (
                    <button
                      key={String(under)}
                      type="button"
                      role="radio"
                      aria-checked={nodeUnder === under}
                      className={`flex-1 min-w-0 truncate px-xs py-[5px] border-none cursor-pointer ${nodeUnder === under ? 'bg-primary text-on-primary' : 'bg-canvas text-ink'}`}
                      onClick={() => setNodeUnder(under)}
                    >
                      {under ? `${selectedNode.name} 아래` : '최상위'}
                    </button>
                  ))}
                </div>
              )}
              <input
                className={inputCls}
                placeholder="이름 입력"
                value={nodeName}
                onChange={(e) => setNodeName(e.target.value)}
                onKeyDown={(e) => {
                  // Enter would submit the task form; Escape would close the whole popup
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); createNode(); }
                  if (e.key === 'Escape') { e.stopPropagation(); setNodeForm(false); }
                }}
                autoFocus
              />
              {/* a sub-category takes its parent's color, like the sidebar */}
              {!nodeUnder && <div className="flex gap-xs flex-wrap">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-6 h-6 rounded-full border-2 cursor-pointer ${nodeColor === c ? 'border-ink' : 'border-transparent'}`}
                    style={{ background: c }}
                    aria-label={`색상 ${c}`}
                    aria-pressed={nodeColor === c}
                    onClick={() => setNodeColor(c)}
                  />
                ))}
              </div>}
              <div className="flex justify-end gap-xs">
                <button type="button" className={smallBtn} onClick={() => setNodeForm(false)}>취소</button>
                <button type="button" className={smallPrimaryBtn} onClick={createNode} disabled={!nodeName.trim() || creatingNode}>
                  {creatingNode ? '만드는 중…' : '분류 만들기'}
                </button>
              </div>
            </div>
          ) : wbsNodes.length > 0 ? (
            <div className={rowCls}>
              <WbsSelect nodes={wbsNodes} value={wbsNodeId} onChange={setWbsNodeId} onAddNew={openNodeForm} />
            </div>
          ) : (
            <div className={rowCls}>
              <span className={`${labelCls} ${nodeErr ? 'text-error' : ''}`}>분류</span>
              <span className={`flex-1 ${nodeErr ? 'text-error' : 'text-muted'}`}>{nodeErr ? '분류를 추가해 주세요' : '아직 분류가 없어요'}</span>
              <button type="button" className={smallBtn} onClick={openNodeForm}>+ 분류 추가</button>
            </div>
          )}
          <div className={rowCls}>
            <span className={labelCls}>담당자</span>
            <select className={`${selectCls} text-ink`} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">미지정</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className={rowCls}>
            <span className={labelCls}>상태</span>
            <select className={`${selectCls} font-medium ${statusCls[status]}`} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              <option value="todo">예정</option>
              <option value="in_progress">진행 중</option>
              <option value="done">완료</option>
            </select>
          </div>
          <div className={rowCls}>
            <span className={labelCls}>우선순위</span>
            <select
              className={`${selectCls} font-medium ${priority ? priorityCls[priority] : 'text-muted-soft'}`}
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority | '')}
            >
              <option value="">없음</option>
              <option value="high">높음</option>
              <option value="medium">보통</option>
              <option value="low">낮음</option>
            </select>
          </div>
        </div>

        {/* memo + url */}
        <div className={groupCls}>
          <textarea
            className={`${fieldCls} w-full resize-none text-body-xs text-ink py-xs px-xxs min-h-[52px] placeholder:text-muted-soft`}
            placeholder="메모 추가"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
          <div className={`${rowCls} border-t border-hairline`}>
            <input
              className={`${fieldCls} flex-1 min-w-0 text-body-xs text-ink py-xxs px-xxs placeholder:text-muted-soft`}
              placeholder="URL 추가"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        </div>

        {showErrors && missing.length > 0 && <p role="alert" className="m-0 text-caption text-error">{missingMessage(missing)}</p>}
        <div className="flex justify-end gap-xs">
          <button type="button" className={secondaryBtn} onClick={onClose}>취소</button>
          <button type="submit" className={primaryBtn}>추가</button>
        </div>
    </>
  );

  if (mobile) {
    return (
      <BottomSheet onClose={onClose}>
        <form className="flex flex-col gap-sm" onSubmit={handleSubmit} noValidate>{fields}</form>
      </BottomSheet>
    );
  }

  return (
    <div className={modalOverlay} onClick={onClose}>
      <form
        className="w-[calc(100%-32px)] max-w-[460px] bg-canvas rounded-lg shadow-card p-md flex flex-col gap-sm"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        noValidate
      >
        {fields}
      </form>
    </div>
  );
}
