import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hashPin, verifyPin, saveSession, getSession, clearSession } from '../auth';
import type { SessionData } from '@/types';

describe('hashPin', () => {
  it('returns consistent hash for same input', async () => {
    const h1 = await hashPin('1234');
    const h2 = await hashPin('1234');
    expect(h1).toBe(h2);
  });

  it('returns different hash for different input', async () => {
    const h1 = await hashPin('1234');
    const h2 = await hashPin('5678');
    expect(h1).not.toBe(h2);
  });
});

describe('verifyPin', () => {
  it('returns true for matching pin', async () => {
    const hash = await hashPin('1234');
    expect(await verifyPin('1234', hash)).toBe(true);
  });

  it('returns false for wrong pin', async () => {
    const hash = await hashPin('1234');
    expect(await verifyPin('0000', hash)).toBe(false);
  });
});

describe('session', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const session: SessionData = {
    user_id: 'u1',
    project_id: 'p1',
    role: 'pm',
  };

  it('saves and retrieves session', () => {
    saveSession(session);
    expect(getSession()).toEqual(session);
  });

  it('returns null when no session', () => {
    expect(getSession()).toBeNull();
  });

  it('clears session', () => {
    saveSession(session);
    clearSession();
    expect(getSession()).toBeNull();
  });
});
