import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin } from '../auth';

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
