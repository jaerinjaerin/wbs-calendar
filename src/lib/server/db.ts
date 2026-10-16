import 'server-only';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// local dev runs a bare PostgREST (supabase/local), which serves at / instead of /rest/v1
const local = url.startsWith('http://localhost');

// secret key bypasses RLS: server actions are the only way into the database
export const db = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: local ? { fetch: (input, init) => fetch(String(input).replace('/rest/v1', ''), init) } : undefined,
});
