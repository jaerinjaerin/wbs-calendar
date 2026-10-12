import { describe, it, expect } from 'vitest';
import { hashPin } from '../auth';
import { passwordMatches } from '../server/password';

describe('passwordMatches', () => {
  it('matches the hash of the same password', async () => {
    expect(await passwordMatches('secret', await hashPin('secret'))).toBe(true);
  });
  it('rejects a different password', async () => {
    expect(await passwordMatches('wrong', await hashPin('secret'))).toBe(false);
  });
  it('rejects a malformed stored hash without throwing', async () => {
    expect(await passwordMatches('secret', 'not-hex')).toBe(false);
    expect(await passwordMatches('secret', '')).toBe(false);
  });
  it('is whitespace-sensitive', async () => {
    expect(await passwordMatches(' secret', await hashPin('secret'))).toBe(false);
  });
});
