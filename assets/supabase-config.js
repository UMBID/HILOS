-- =====================================================================
-- HILOS — Schema Database Produk (Supabase / Postgres)
-- Jalankan seluruh file ini sekali lewat: Supabase Dashboard > SQL Editor > New query > Run
-- =====================================================================

-- 1) Tabel produk
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,                         -- kode produk internal HILOS, contoh: "WV-PRO-BLK"
  name text not null,
  model text not null,
  category text not null check (category in ('pria','wanita','anak')),
  price integer not null default 0,
  images jsonb not null default '[]',      -- array of image URLs, contoh: ["https://.../a.jpg","https://.../b.jpg"]
  colors jsonb not null default '[]',      -- array of {"hex":"#1c1a18","name":"Hitam"}
  sizes integer[] not null default '{}',   -- contoh: {38,39,40,41,42}
  badge text,                              -- 'best' | 'new' | null
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- auto-update updated_at tiap kali row diubah
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_products_updated_at on products;
create trigger trg_products_updated_at
  before update on products
  for each row execute function set_updated_at();

-- 2) Row Level Security
alter table products enable row level security;

-- Publik (pengunjung website) boleh baca semua produk
drop policy if exists "Public can read products" on products;
create policy "Public can read products"
  on products for select
  to anon
  using (true);

-- Hanya user yang sudah login (admin) yang boleh tambah/ubah/hapus
drop policy if exists "Authenticated can manage products" on products;
create policy "Authenticated can manage products"
  on products for all
  to authenticated
  using (true)
  with check (true);

-- 3) Storage bucket untuk foto produk
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Publik boleh lihat/download foto
drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
  on storage.objects for select
  to anon
  using (bucket_id = 'product-images');

-- Hanya admin (login) yang boleh upload/hapus foto
drop policy if exists "Authenticated can upload product images" on storage.objects;
create policy "Authenticated can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "Authenticated can delete product images" on storage.objects;
create policy "Authenticated can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');

-- =====================================================================
-- Selesai. Langkah berikutnya di luar SQL Editor:
-- 1. Authentication > Users > Add user  → buat 1 akun admin (email + password)
-- 2. Project Settings > API → salin "Project URL" dan "anon public key"
--    lalu isi ke file assets/supabase-config.js
-- 3. (Opsional) isi beberapa produk contoh lewat halaman admin.html
-- =====================================================================

-- =====================================================================
-- MIGRASI TAMBAHAN — jalankan ini di SQL Editor kalau tabel products
-- sudah lebih dulu dibuat sebelum kolom sku ditambahkan (aman dijalankan berkali-kali)
-- =====================================================================
alter table products add column if not exists sku text;
create unique index if not exists products_sku_key on products (sku) where sku is not null;

-- =====================================================================
-- TOP 10 PRODUK — riwayat rank per bulan, diisi manual oleh admin
-- Jalankan ini juga di SQL Editor (aman dijalankan sekali)
-- =====================================================================
create table if not exists top10_rankings (
  id uuid primary key default gen_random_uuid(),
  month text not null,                              -- format 'YYYY-MM', contoh: '2026-01'
  rank int not null check (rank between 1 and 10),
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (month, rank),        -- satu rank cuma boleh 1 produk per bulan
  unique (month, product_id)   -- satu produk cuma boleh 1 rank per bulan
);

alter table top10_rankings enable row level security;

drop policy if exists "Public can read top10" on top10_rankings;
create policy "Public can read top10"
  on top10_rankings for select
  to anon
  using (true);

drop policy if exists "Authenticated can manage top10" on top10_rankings;
create policy "Authenticated can manage top10"
  on top10_rankings for all
  to authenticated
  using (true)
  with check (true);

-- =====================================================================
-- CUTOUTS — SUDAH TIDAK DIPAKAI (deprecated). Konsep panel 3D lama (1 foto
-- + hapus-background-otomatis + CSS rotateY) diganti konsep baru: foto 360°
-- multi-angle (lihat catatan "SPIN" di bawah). Kolom ini dibiarkan ada di
-- database (tidak di-drop, aman kalau masih ada data lama) tapi admin.html
-- dan flagship.html sudah tidak membaca/menulis kolom ini lagi.
-- =====================================================================
alter table products add column if not exists cutouts jsonb not null default '{}'::jsonb;

-- =====================================================================
-- SPIN (foto 360° multi-angle untuk panel 3D) — TIDAK PERLU MIGRASI BARU.
-- Setiap warna di kolom `colors` (sudah ada) sekarang bisa punya field
-- opsional `spin`: array url foto produk dari banyak sudut, contoh:
--   colors: [{ "hex":"#1c1a18", "name":"Hitam", "image":"<url>", "spin":["<url1>","<url2>",...] }]
-- Diisi admin.html lewat tombol "+ Foto 360°" di tiap baris warna. Kalau
-- sebuah warna tidak punya field `spin` (atau kurang dari 2 foto), panel
-- 360° di flagship.html otomatis menampilkan pesan "belum tersedia" untuk
-- warna itu — tidak ada yang rusak kalau belum diisi.

-- =====================================================================
-- IS_3D — FLAG ON/OFF fitur 3D per produk (WAJIB DIJALANKAN, aman diulang)
-- true  = produk punya tampilan 3D (360°) & halaman flagship.html bisa dibuka
-- false = produk biasa: tidak ada 3D, flagship.html tidak bisa diakses
-- Diatur lewat toggle "Aktifkan 3D" di form produk admin.html.
-- =====================================================================
alter table products add column if not exists is_3d boolean not null default false;
