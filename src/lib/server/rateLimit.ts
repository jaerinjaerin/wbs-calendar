// Pure rate limit logic; the DB call is injected so this stays testable.

export type LimitKind = 'project_create' | 'create' | 'read' | 'write' | 'auth';

export const LIMITS: Record<LimitKind, { windowSeconds: number; max: number }> = {
  project_create: { windowSeconds: 3600, max: 5 },
  create: { windowSeconds: 60, max: 60 },
  read: { windowSeconds: 60, max: 900 },
  write: { windowSeconds: 60, max: 300 },
  auth: { windowSeconds: 60, max: 10 },
};

export type HitRpc = (args: { p_key: string; p_window_seconds: number; p_max: number }) => PromiseLike<{ data: unknown; error: unknown }>;

// Vercel overwrites x-forwarded-for, so the first entry is the real client
export function clientIp(forwardedFor: string | null): string {
  return forwardedFor?.split(',')[0]?.trim() || 'unknown';
}

// ponytail: fixed window, so up to 2x max can pass across a window boundary; use a sliding window if that ever matters
export async function isAllowed(hit: HitRpc, kind: LimitKind, ip: string): Promise<boolean> {
  const { windowSeconds, max } = LIMITS[kind];
  try {
    const { data, error } = await hit({ p_key: `${kind}:${ip}`, p_window_seconds: windowSeconds, p_max: max });
    if (error) throw error;
    return data !== false;
  } catch (e) {
    // fail open: a broken limiter must not lock out real users
    console.error('rate limit check failed', e);
    return true;
  }
}
