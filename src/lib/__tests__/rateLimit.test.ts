import { describe, it, expect, vi } from 'vitest';
import { clientIp, isAllowed, LIMITS } from '../server/rateLimit';

describe('clientIp', () => {
  it('takes the first forwarded address, trimmed', () => {
    expect(clientIp(' 203.0.113.7 , 10.0.0.1')).toBe('203.0.113.7');
  });
  it('handles a single address', () => expect(clientIp('198.51.100.2')).toBe('198.51.100.2'));
  it('falls back to "unknown" when missing or empty', () => {
    expect(clientIp(null)).toBe('unknown');
    expect(clientIp('')).toBe('unknown');
    expect(clientIp(' , 10.0.0.1')).toBe('unknown');
  });
});

describe('isAllowed', () => {
  it('passes kind-scoped key and the configured limit to the rpc', async () => {
    const hit = vi.fn().mockResolvedValue({ data: true, error: null });
    await isAllowed(hit, 'create', '203.0.113.7');
    expect(hit).toHaveBeenCalledWith({
      p_key: 'create:203.0.113.7',
      p_window_seconds: LIMITS.create.windowSeconds,
      p_max: LIMITS.create.max,
    });
  });
  it('allows when the rpc returns true', async () => {
    expect(await isAllowed(async () => ({ data: true, error: null }), 'read', 'x')).toBe(true);
  });
  it('blocks when the rpc returns false', async () => {
    expect(await isAllowed(async () => ({ data: false, error: null }), 'read', 'x')).toBe(false);
  });
  it('fails open when the rpc reports an error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await isAllowed(async () => ({ data: null, error: { message: 'down' } }), 'read', 'x')).toBe(true);
    spy.mockRestore();
  });
  it('fails open when the rpc throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await isAllowed(async () => { throw new Error('network'); }, 'read', 'x')).toBe(true);
    spy.mockRestore();
  });
});

describe('LIMITS', () => {
  it('matches the spec', () => {
    expect(LIMITS).toEqual({
      project_create: { windowSeconds: 3600, max: 5 },
      create: { windowSeconds: 60, max: 60 },
      read: { windowSeconds: 60, max: 900 },
      write: { windowSeconds: 60, max: 300 },
      auth: { windowSeconds: 60, max: 10 },
    });
  });
});
