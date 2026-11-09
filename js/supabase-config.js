// Isi dengan data dari Supabase: Project Settings > API
// Anon key aman ada di frontend selama RLS aktif (sudah diatur di tahap1.sql).
// Jangan pernah taruh service_role key di sini.
const SUPABASE_URL = "https://ercaruihdmdvahvfbvwm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6q9dNzDj026HTQf35LW__g_hPinVgek";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);