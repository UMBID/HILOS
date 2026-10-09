// =====================================================================
// Supabase Edge Function: admin-users
// Dipakai tab "Kelola Admin" di admin.html (hanya Super Admin).
// Fungsi ini memakai SERVICE ROLE KEY (otomatis tersedia di Supabase),
// jadi kunci rahasia itu TIDAK pernah ada di file website.
//
// Cara pasang (tanpa terminal):
//   Supabase Dashboard → Edge Functions → "Deploy a new function" → "Via Editor"
//   Nama fungsi: admin-users  (harus persis)
//   Hapus isi contoh, tempel seluruh isi file ini, klik Deploy.
//   Biarkan "Verify JWT" tetap menyala.
// =====================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const reply = (obj: unknown) =>
  new Response(JSON.stringify(obj), { headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1) siapa yang memanggil?
    const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return reply({ ok: false, error: 'Sesi habis. Silakan login ulang.' });

    const db = createClient(url, service, { auth: { persistSession: false } });

    // 2) harus Super Admin aktif
    const { data: me } = await db.from('admin_profiles').select('role,is_active').eq('user_id', user.id).maybeSingle();
    if (!me || !me.is_active || me.role !== 'super_admin') return reply({ ok: false, error: 'Hanya Super Admin yang boleh melakukan ini.' });

    const body = await req.json();
    const action = String(body.action || '');
    const audit = (act: string, target: string) =>
      db.from('admin_audit').insert({ actor_email: user.email, action: act, target_email: target });

    // ---- buat admin baru ----
    if (action === 'create') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply({ ok: false, error: 'Format email tidak valid.' });
      if (password.length < 8) return reply({ ok: false, error: 'Password sementara minimal 8 karakter.' });
      const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) {
        const m = (error?.message || '').toLowerCase();
        return reply({ ok: false, error: m.includes('already') || m.includes('registered') ? 'Email ini sudah terdaftar.' : (error?.message || 'Gagal membuat akun.') });
      }
      const { error: pe } = await db.from('admin_profiles').insert({
        user_id: data.user.id, email, role: 'admin', must_change_password: true, is_active: true, created_by: user.email,
      });
      if (pe) { await db.auth.admin.deleteUser(data.user.id); return reply({ ok: false, error: 'Gagal menyimpan profil: ' + pe.message }); }
      await audit('buat_admin', email);
      return reply({ ok: true });
    }

    // aksi lain butuh target admin biasa
    const targetId = String(body.user_id || '');
    const { data: target } = await db.from('admin_profiles').select('user_id,email,role').eq('user_id', targetId).maybeSingle();
    if (!target) return reply({ ok: false, error: 'Admin tidak ditemukan.' });
    if (target.role === 'super_admin' || target.user_id === user.id) return reply({ ok: false, error: 'Akun Super Admin tidak bisa diubah dari sini.' });

    if (action === 'reset_password') {
      const password = String(body.password || '');
      if (password.length < 8) return reply({ ok: false, error: 'Password sementara minimal 8 karakter.' });
      const { error } = await db.auth.admin.updateUserById(targetId, { password });
      if (error) return reply({ ok: false, error: error.message });
      await db.from('admin_profiles').update({ must_change_password: true }).eq('user_id', targetId);
      await audit('reset_password', target.email);
      return reply({ ok: true });
    }

    if (action === 'set_active') {
      const active = !!body.active;
      await db.from('admin_profiles').update({ is_active: active }).eq('user_id', targetId);
      await db.auth.admin.updateUserById(targetId, { ban_duration: active ? 'none' : '876000h' });
      await audit(active ? 'aktifkan' : 'nonaktifkan', target.email);
      return reply({ ok: true });
    }

    if (action === 'delete') {
      await audit('hapus_admin', target.email);
      const { error } = await db.auth.admin.deleteUser(targetId);
      if (error) return reply({ ok: false, error: error.message });
      return reply({ ok: true });
    }

    return reply({ ok: false, error: 'Aksi tidak dikenal.' });
  } catch (e) {
    return reply({ ok: false, error: 'Kesalahan server: ' + (e as Error).message });
  }
});
