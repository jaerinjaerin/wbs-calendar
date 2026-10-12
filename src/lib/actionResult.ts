// Result shape shared by server actions and their callers; mirrors supabase-js so call sites barely change.

export type ActionError = { code: string; message: string };
export type ActionResult<T> = { data: T | null; error: ActionError | null };

export const RATE_LIMITED_MESSAGE = '요청이 너무 많아요. 잠시 후 다시 시도해 주세요';

export function ok<T>(data: T): ActionResult<T> {
  return { data, error: null };
}

export function fail(code: string, message = code): ActionResult<never> {
  return { data: null, error: { code, message } };
}

// copies only plain fields: server actions can't return PostgrestError instances
export function fromDb<T>(res: { data: T | null; error: { code: string; message: string } | null }): ActionResult<T> {
  return res.error ? fail(res.error.code, res.error.message) : ok(res.data as T);
}

export function errorMessage(error: ActionError | null, fallback: string): string {
  return error?.code === 'rate_limited' ? RATE_LIMITED_MESSAGE : fallback;
}
