import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('WARNING: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in your .env file!');
}

// 1. Export the main database connection client
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// 2. Export getSupabase so files looking for this specific function won't crash
export function getSupabase() {
  return supabase;
}