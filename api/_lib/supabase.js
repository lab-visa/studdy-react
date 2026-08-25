/**
 * Shared Supabase admin client for all serverless functions.
 *
 * Uses the SERVICE ROLE key — this bypasses Row Level Security,
 * which is correct here because these functions only ever run on
 * our own server (never in the browser). Never import this file
 * or use this key anywhere in src/ (the frontend).
 */
import { createClient } from '@supabase/supabase-js';

let client;

export function getSupabase() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable'
      );
    }

    client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return client;
}
