// Caller check for server routes that must only serve Chris and Krista:
// the browser sends its Supabase access token as `Authorization: Bearer`,
// we verify it with auth.getUser(token), then call public.is_household()
// as that user. Only the publishable key is used (as the apikey); Stint
// Ledger holds no Supabase secret key, and none is needed here.

import { createClient } from '@supabase/supabase-js';

export type HouseholdCheck =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 | 500; error: string };

export function bearerFrom(header: unknown): string | null {
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== 'string') return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(value);
  return m ? m[1] : null;
}

export async function requireHousehold(authorization: unknown): Promise<HouseholdCheck> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY; // holds the sb_publishable_ key
  if (!url || !key) return { ok: false, status: 500, error: 'Supabase is not configured' };

  const token = bearerFrom(authorization);
  if (!token) return { ok: false, status: 401, error: 'Sign in required' };

  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await auth.auth.getUser(token);
  if (userError || !userData?.user) return { ok: false, status: 401, error: 'Sign in required' };

  // is_household() reads auth.uid(), so call it as the user.
  const asUser = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: isHousehold, error: rpcError } = await asUser.rpc('is_household');
  if (rpcError || isHousehold !== true) return { ok: false, status: 403, error: 'Not available for this account' };

  return { ok: true, userId: userData.user.id };
}
