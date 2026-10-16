/* =====================================================================
   WHATSAPP HILOS — SATU-SATUNYA tempat mengubah nomor & teks template chat.
   Semua tombol WhatsApp, link telepon, dan nomor yang tampil di semua halaman
   membaca file ini.
   ===================================================================== */
(function(){
  const CONFIG = {
    // Nomor format internasional: tanpa "+", tanpa "0" di depan, tanpa spasi/strip.
    number: '628133333273',

    // Template pesan. Baris "Nama:" dst. dibiarkan kosong supaya diisi pengunjung,
    // lalu tinggal menekan kirim. {produk} {kode} {warna} {ukuran} diisi otomatis.
    templates: {
      general:
        'Halo Tim HILOS,\n\nSaya ingin bertanya tentang produk HILOS.\n\nNama: \nKota & Alamat: \nPertanyaan: \nSkema Kerjasama: ',
      kontak:
        'Halo Tim HILOS,\n\nSaya ingin menghubungi tim HILOS.\n\nNama: \nKota & Alamat: \nTopik (Pertanyaan Produk / Status Pesanan / Komplain-Garansi / Lainnya): \nPesan: ',
      kerjasama:
        'Halo Tim HILOS,\n\nSaya tertarik untuk bekerjasama dengan HILOS.\n\nNama: \nNama Perusahaan/Toko: \nKota & Alamat: \nSkema Kerjasama (Distributor / E-Commerce / Wholesale / Manufacture Partner): \nPertanyaan: ',
      produk:
        'Halo Tim HILOS,\n\nSaya ingin bertanya tentang produk berikut:\n{detail}\n\nNama: \nKota & Alamat: \nPertanyaan: \nSkema Kerjasama: '
    }
  };

  function url(type, data){
    let text = CONFIG.templates[type] || CONFIG.templates.general;
    if (type === 'produk'){
      const d = data || {};
      const lines = [];
      if (d.name)  lines.push('• Produk: ' + d.name);
      if (d.sku)   lines.push('• Kode: ' + d.sku);
      if (d.color) lines.push('• Warna: ' + d.color);
      if (d.size)  lines.push('• Ukuran: ' + d.size);
      text = text.replace('{detail}', lines.join('\n') || '• (sebutkan nama produk)');
    }
    return 'https://wa.me/' + CONFIG.number + '?text=' + encodeURIComponent(text);
  }
  function open(type, data){
    try { window.HilosTrack && window.HilosTrack.wa(type, data); } catch(e){}
    window.open(url(type, data), '_blank', 'noopener');
  }

  // Ambil detail produk yang sedang tampil di halaman (nama, warna, ukuran terpilih)
  function productFromPage(extra){
    const t = (sel) => { const el = document.querySelector(sel); return el ? el.textContent.trim() : ''; };
    return Object.assign({ name: t('.product-info h3'), color: t('#colorValue'), size: t('#sizeValue') }, extra || {});
  }

  // 0813-3333-273 dari 628133333273
  function pretty(n){
    const local = '0' + String(n).replace(/^62/, '');
    return local.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
  }

  function apply(){
    document.querySelectorAll('a[data-wa]').forEach(a => {
      a.href = url(a.dataset.wa);
      a.target = '_blank'; a.rel = 'noopener';
      if (!a.dataset.waTrack){ a.dataset.waTrack = '1'; a.addEventListener('click', () => { try { window.HilosTrack && window.HilosTrack.wa(a.dataset.wa); } catch(e){} }); }
    });
    document.querySelectorAll('a[data-wa-tel]').forEach(a => {
      a.href = 'tel:+' + CONFIG.number;
      a.textContent = pretty(CONFIG.number);
    });
    document.querySelectorAll('[data-wa-text]').forEach(el => { el.textContent = pretty(CONFIG.number); });
  }

  /* ---- tombol WhatsApp melayang: tidak menutupi konten di HP ----
     - mengikuti area aman layar (notch / bar bawah iPhone)
     - menyingkir saat pengunjung scroll ke bawah, muncul lagi saat scroll ke atas atau berhenti sebentar
     - ruang ekstra di dasar halaman supaya baris terakhir footer tidak tertutup */
  function floatBehavior(){
    const w = document.querySelector('.wa-widget'); if (!w) return;
    const st = document.createElement('style');
    st.textContent =
      '.wa-widget{right:max(16px,env(safe-area-inset-right)) !important;bottom:max(16px,env(safe-area-inset-bottom)) !important;transition:transform .3s ease,opacity .3s ease;}' +
      '.wa-widget.wa-away{transform:translateY(calc(100% + 40px));opacity:0;pointer-events:none;}' +
      '@media (max-width:640px){.footer-bottom{padding-bottom:88px !important;}}' +
      '@media (prefers-reduced-motion:reduce){.wa-widget{transition:none;}.wa-widget.wa-away{transform:none;opacity:1;pointer-events:auto;}}';
    document.head.appendChild(st);
    const mq = window.matchMedia('(max-width:640px)');
    let last = window.scrollY, idle = 0;
    const show = () => w.classList.remove('wa-away');
    window.addEventListener('scroll', () => {
      const y = window.scrollY, d = y - last; last = y;
      if (!mq.matches || document.querySelector('.wa-popup.open')){ show(); return; }
      if (d > 6 && y > 240) w.classList.add('wa-away'); else if (d < -6 || y <= 240) show();
      clearTimeout(idle); idle = setTimeout(show, 1400);
    }, { passive:true });
  }
  const init = () => { apply(); floatBehavior(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.HilosWA = { config: CONFIG, url, open, productFromPage, pretty, apply };
})();
