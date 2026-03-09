// Supabase設定
const SUPABASE_URL = 'https://griiiidgnpgsmeltgekx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyaWlpaWRnbnBnc21lbHRnZWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNTczMjIsImV4cCI6MjA4ODYzMzMyMn0.C1dJP1PlXFRUI2Yylm705-9m7tKANEsnnwQJ6EePYCc';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { db };
