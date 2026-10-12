import 'server-only';
import { createClient } from '@supabase/supabase-js';

// secret key bypasses RLS: server actions are the only way into the database
export const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
