import { describe, it, expect } from 'vitest';
import { isUuid, cleanName, cleanPassword, isDate, cleanTaskChanges, cleanNewTask, cleanNewWbsNode } from '../validate';

const ID = '3f2b8c1e-9a4d-4e2f-8b7a-1c2d3e4f5a6b';
const ID2 = '7a1b2c3d-4e5f-4a6b-9c8d-0e1f2a3b4c5d';

describe('isUuid', () => {
  it('accepts a v4 uuid', () => expect(isUuid(ID)).toBe(true));
  it('rejects other strings and non-strings', () => {
    expect(isUuid('abc')).toBe(false);
    expect(isUuid(123)).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});

describe('cleanName', () => {
  it('trims', () => expect(cleanName('  분류 A  ')).toBe('분류 A'));
  it('rejects blank, too long, non-string', () => {
    expect(cleanName('   ')).toBeNull();
    expect(cleanName('a'.repeat(101))).toBeNull();
    expect(cleanName(5)).toBeNull();
  });
  it('accepts exactly 100 chars', () => expect(cleanName('a'.repeat(100))).toBe('a'.repeat(100)));
});

describe('cleanPassword', () => {
  it('keeps surrounding spaces so existing hashes still match', () => {
    expect(cleanPassword(' pw ')).toBe(' pw ');
  });
  it('rejects empty and too long', () => {
    expect(cleanPassword('')).toBeNull();
    expect(cleanPassword('a'.repeat(101))).toBeNull();
  });
});

describe('isDate', () => {
  it('accepts real dates', () => {
    expect(isDate('2026-10-12')).toBe(true);
    expect(isDate('2028-02-29')).toBe(true);
  });
  it('rejects impossible or malformed dates', () => {
    expect(isDate('2026-02-30')).toBe(false);
    expect(isDate('2026-13-01')).toBe(false);
    expect(isDate('2026-1-5')).toBe(false);
    expect(isDate('2026-10-12T00:00')).toBe(false);
  });
});

describe('cleanTaskChanges', () => {
  it('accepts a single end_date (calendar resize)', () => {
    expect(cleanTaskChanges({ end_date: '2026-10-20' })).toEqual({ end_date: '2026-10-20' });
  });
  it('accepts same-day start and end', () => {
    expect(cleanTaskChanges({ start_date: '2026-10-12', end_date: '2026-10-12' })).not.toBeNull();
  });
  it('rejects start after end', () => {
    expect(cleanTaskChanges({ start_date: '2026-10-13', end_date: '2026-10-12' })).toBeNull();
  });
  it('drops unknown fields and rejects when nothing editable remains', () => {
    expect(cleanTaskChanges({ name: '작업', id: ID, evil: 1 })).toEqual({ name: '작업' });
    expect(cleanTaskChanges({ evil: 1 })).toBeNull();
  });
  it('allows clearing nullable fields', () => {
    expect(cleanTaskChanges({ assignee_id: null, priority: null, memo: null, url: null }))
      .toEqual({ assignee_id: null, priority: null, memo: null, url: null });
  });
  it('rejects bad enums, ids and oversized text', () => {
    expect(cleanTaskChanges({ status: 'archived' })).toBeNull();
    expect(cleanTaskChanges({ priority: 'urgent' })).toBeNull();
    expect(cleanTaskChanges({ wbs_node_id: 'x' })).toBeNull();
    expect(cleanTaskChanges({ memo: 'a'.repeat(2001) })).toBeNull();
    expect(cleanTaskChanges({ name: '  ' })).toBeNull();
  });
});

describe('cleanNewTask', () => {
  const base = { id: ID, name: ' 새 작업 ', start_date: '2026-10-12', end_date: '2026-10-14', wbs_node_id: ID2, status: 'todo' };
  it('fills optional fields with defaults', () => {
    expect(cleanNewTask(base)).toEqual({
      id: ID, name: '새 작업', start_date: '2026-10-12', end_date: '2026-10-14', wbs_node_id: ID2,
      status: 'todo', assignee_id: null, priority: null, memo: null, url: null,
    });
  });
  it('requires id, name, dates and category', () => {
    expect(cleanNewTask({ ...base, id: 'x' })).toBeNull();
    expect(cleanNewTask({ ...base, name: undefined })).toBeNull();
    expect(cleanNewTask({ ...base, end_date: undefined })).toBeNull();
    expect(cleanNewTask({ ...base, wbs_node_id: undefined })).toBeNull();
  });
});

describe('cleanNewWbsNode', () => {
  const base = { project_id: ID, parent_id: null, name: ' 기획 ', sort_order: 1, color: '#4472C4', depth: 0 };
  it('accepts a root node and trims the name', () => {
    expect(cleanNewWbsNode(base)).toEqual({ ...base, name: '기획' });
  });
  it('accepts a child node', () => {
    expect(cleanNewWbsNode({ ...base, parent_id: ID2, depth: 1 })).not.toBeNull();
  });
  it('rejects bad color, depth, parent and project', () => {
    expect(cleanNewWbsNode({ ...base, color: 'red' })).toBeNull();
    expect(cleanNewWbsNode({ ...base, depth: -1 })).toBeNull();
    expect(cleanNewWbsNode({ ...base, depth: 1.5 })).toBeNull();
    expect(cleanNewWbsNode({ ...base, parent_id: 'x' })).toBeNull();
    expect(cleanNewWbsNode({ ...base, project_id: undefined })).toBeNull();
  });
});
