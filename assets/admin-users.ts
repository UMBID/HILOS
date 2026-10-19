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

// KEAMANAN: batasi asal permintaan. Di Supabase > Edge Functions > admin-users > Secrets,
// tambahkan ALLOWED_ORIGINS = https://www.hilos.id,https://umbid.github.io
// (pisahkan dengan koma). Kalau belum diisi, semua asal diizinkan (seperti sebelumnya).
const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const corsFor = (req: Request) => {
  const origin = req.headers.get('Origin') ?? '';
  const allow = ALLOWED.length === 0 ? '*' : (ALLOWED.includes(origin) ? origin : ALLOWED[0]);
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const cors = corsFor(req);
  const reply = (obj: unknown) =>
    new Response(JSON.stringify(obj), { headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ ok: false, error: 'Metode tidak didukung.' });
  if (ALLOWED.length && !ALLOWED.includes(req.headers.get('Origin') ?? '')) return reply({ ok: false, error: 'Asal permintaan tidak diizinkan.' });
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

    const raw = await req.text();
    if (raw.length > 4000) return reply({ ok: false, error: 'Permintaan terlalu besar.' });
    let body: any;
    try { body = JSON.parse(raw); } catch { return reply({ ok: false, error: 'Permintaan tidak valid.' }); }
    if (!body || typeof body !== 'object') return reply({ ok: false, error: 'Permintaan tidak valid.' });
    const action = String(body.action || '');
    const audit = (act: string, target: string) =>
      db.from('admin_audit').insert({ actor_email: user.email, action: act, target_email: target });

    // ---- buat admin baru ----
    if (action === 'create') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply({ ok: false, error: 'Format email tidak valid.' });
      if (email.length > 254) return reply({ ok: false, error: 'Email terlalu panjang.' });
      if (password.length < 8 || password.length > 72) return reply({ ok: false, error: 'Password sementara 8–72 karakter.' });
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
    if (!UUID.test(targetId)) return reply({ ok: false, error: 'ID akun tidak valid.' });
    const { data: target } = await db.from('admin_profiles').select('user_id,email,role').eq('user_id', targetId).maybeSingle();
    if (!target) return reply({ ok: false, error: 'Admin tidak ditemukan.' });
    // akun sendiri tidak boleh diubah di sini (supaya tidak terkunci); minta Super Admin lain
    if (target.user_id === user.id) return reply({ ok: false, error: 'Akun Anda sendiri tidak bisa diubah dari sini. Minta Super Admin lain jika perlu.' });

    // pengaman: harus selalu tersisa minimal 1 Super Admin aktif selain target
    const lastSuperGuard = async () => {
      if (target.role !== 'super_admin') return true;
      const { count } = await db.from('admin_profiles').select('user_id', { count: 'exact', head: true })
        .eq('role', 'super_admin').eq('is_active', true).neq('user_id', targetId);
      return (count ?? 0) >= 1;
    };

    if (action === 'promote') {
      if (target.role === 'super_admin') return reply({ ok: false, error: 'Akun ini sudah Super Admin.' });
      const { data: t2 } = await db.from('admin_profiles').select('is_active').eq('user_id', targetId).maybeSingle();
      if (!t2?.is_active) return reply({ ok: false, error: 'Aktifkan akun ini dulu sebelum dijadikan Super Admin.' });
      await db.from('admin_profiles').update({ role: 'super_admin' }).eq('user_id', targetId);
      await audit('jadikan_super_admin', target.email);
      return reply({ ok: true });
    }

    if (action === 'demote') {
      if (target.role !== 'super_admin') return reply({ ok: false, error: 'Akun ini bukan Super Admin.' });
      if (!(await lastSuperGuard())) return reply({ ok: false, error: 'Harus tersisa minimal 1 Super Admin aktif.' });
      await db.from('admin_profiles').update({ role: 'admin' }).eq('user_id', targetId);
      await audit('cabut_super_admin', target.email);
      return reply({ ok: true });
    }

    if (action === 'reset_password') {
      const password = String(body.password || '');
      if (email.length > 254) return reply({ ok: false, error: 'Email terlalu panjang.' });
      if (password.length < 8 || password.length > 72) return reply({ ok: false, error: 'Password sementara 8–72 karakter.' });
      const { error } = await db.auth.admin.updateUserById(targetId, { password });
      if (error) return reply({ ok: false, error: error.message });
      await db.from('admin_profiles').update({ must_change_password: true }).eq('user_id', targetId);
      await audit('reset_password', target.email);
      return reply({ ok: true });
    }

    if (action === 'set_active') {
      const active = !!body.active;
      if (!active && !(await lastSuperGuard())) return reply({ ok: false, error: 'Harus tersisa minimal 1 Super Admin aktif.' });
      await db.from('admin_profiles').update({ is_active: active }).eq('user_id', targetId);
      await db.auth.admin.updateUserById(targetId, { ban_duration: active ? 'none' : '876000h' });
      await audit(active ? 'aktifkan' : 'nonaktifkan', target.email);
      return reply({ ok: true });
    }

    if (action === 'delete') {
      if (!(await lastSuperGuard())) return reply({ ok: false, error: 'Harus tersisa minimal 1 Super Admin aktif.' });
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
