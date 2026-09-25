import { createClient } from '@supabase/supabase-js';

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
  .trim()
  .replace(/['"]/g, "")
  .replace(/\/rest\/v1\/?$/, "")
  .replace(/\/+$/, "");

const rawKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim().replace(/['"]/g, "");

export const supabase = createClient(rawUrl, rawKey);


