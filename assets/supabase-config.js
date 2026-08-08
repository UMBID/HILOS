// =====================================================================
// ISI DUA NILAI INI dari Supabase Dashboard > Project Settings > API
// - Project URL          → SUPABASE_URL
// - anon public key      → SUPABASE_ANON_KEY  (JANGAN pakai service_role key di sini)
// =====================================================================
window.SUPABASE_URL = "https://qzrwmiyaeckqnotvpuyy.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_Lp-GcZpyPjBpasi5z8UrpA_-Y4GIIPJ";

window.getSupabaseClient = function () {
  if (!window._sbClient) {
    window._sbClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }
  return window._sbClient;
};

