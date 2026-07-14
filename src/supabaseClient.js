import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dchliszajubvvuupkqlz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjaGxpc3phanVidnZ1dXBrcWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNTQxNzgsImV4cCI6MjA5NjYzMDE3OH0.Cirv9G7k6suAYU3arkvvoqEMiPEJ8WWbCbJ1n2ffJ6Q';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
