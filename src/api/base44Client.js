// The app's data client. It used to be the Base44 SDK; it is now Supabase
// behind the same `base44.entities.*` calls (see ./compat.js), so the game code
// didn't have to be rewritten.
import { createClient } from '@supabase/supabase-js';
import { createBase44Compat } from './compat';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/config';

const url = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Wonder Sync: the Supabase URL / anon key are not set (src/config.js or .env.local).');
}

export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-key', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 20 } },
});

export const base44 = createBase44Compat(supabase);
