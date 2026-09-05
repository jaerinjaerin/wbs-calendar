import type { SessionData } from '@/types';

const SESSION_KEY = 'wbs-cal-session';

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const pinHash = await hashPin(pin);
  return pinHash === hash;
}

export function saveSession(data: SessionData): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function getSession(): SessionData | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as SessionData;
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
