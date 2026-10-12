import { timingSafeEqual } from 'crypto';
import { hashPin } from '@/lib/auth';

// constant-time compare so response timing can't leak how much of the hash matched
export async function passwordMatches(password: string, hash: string): Promise<boolean> {
  const a = Buffer.from(await hashPin(password), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
