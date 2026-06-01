import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const SUPABASE_URL = Constants.expoConfig?.extra?.SUPABASE_URL;
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase environment variables. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env and restart the app.'
  );
}

export const supabase = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string);
