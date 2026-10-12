import { describe, it, expect } from 'vitest';
import { ok, fail, fromDb, errorMessage, RATE_LIMITED_MESSAGE } from '../actionResult';

describe('fromDb', () => {
  it('keeps data on success', () => {
    expect(fromDb({ data: [1], error: null })).toEqual({ data: [1], error: null });
  });
  it('keeps the postgres code so callers can treat 23505 as already-saved', () => {
    expect(fromDb({ data: null, error: { code: '23505', message: 'duplicate key' } }))
      .toEqual({ data: null, error: { code: '23505', message: 'duplicate key' } });
  });
});

describe('ok / fail', () => {
  it('builds plain results', () => {
    expect(ok('x')).toEqual({ data: 'x', error: null });
    expect(fail('rate_limited')).toEqual({ data: null, error: { code: 'rate_limited', message: 'rate_limited' } });
  });
});

describe('errorMessage', () => {
  it('uses the rate limit copy for rate_limited', () => {
    expect(errorMessage({ code: 'rate_limited', message: '' }, '작업 추가에 실패했습니다')).toBe(RATE_LIMITED_MESSAGE);
    expect(RATE_LIMITED_MESSAGE).toBe('요청이 너무 많아요. 잠시 후 다시 시도해 주세요');
  });
  it('uses the fallback otherwise, including null', () => {
    expect(errorMessage({ code: '42501', message: '' }, '작업 추가에 실패했습니다')).toBe('작업 추가에 실패했습니다');
    expect(errorMessage(null, '작업 추가에 실패했습니다')).toBe('작업 추가에 실패했습니다');
  });
});
