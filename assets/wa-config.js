/* =====================================================================
   WHATSAPP HILOS — SATU-SATUNYA tempat mengubah nomor & teks template chat.
   Semua tombol WhatsApp, link telepon, dan nomor yang tampil di semua halaman
   membaca file ini.
   ===================================================================== */
(function(){
  const CONFIG = {
    // Nomor format internasional: tanpa "+", tanpa "0" di depan, tanpa spasi/strip.
    number: '6281234567890',

    // Template pesan. Baris "Nama:" dst. dibiarkan kosong supaya diisi pengunjung,
    // lalu tinggal menekan kirim. {produk} {kode} {warna} {ukuran} diisi otomatis.
    templates: {
      general:
        'Halo HILOS 👋\nSaya ingin bertanya tentang produk HILOS.\n\nNama: \nKota: \nPertanyaan: ',
      kontak:
        'Halo HILOS 👋\nSaya ingin menghubungi tim HILOS.\n\nNama: \nTopik (Pertanyaan Produk / Status Pesanan / Komplain-Garansi / Lainnya): \nPesan: ',
      kerjasama:
        'Halo HILOS 👋\nSaya tertarik untuk bekerjasama dengan HILOS.\n\nNama: \nNama Perusahaan/Toko: \nJenis kerjasama (Distributor / E-Commerce / Wholesale / Manufacture Partner): \nKota: \n\nMohon info syarat dan ketentuannya. Terima kasih.',
      produk:
        'Halo HILOS 👋\nSaya tertarik dengan produk berikut:\n{detail}\n\nNama: \nKota: \n\nMohon info ketersediaan dan cara pemesanannya. Terima kasih.'
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
  function open(type, data){ window.open(url(type, data), '_blank', 'noopener'); }

  // Ambil detail produk yang sedang tampil di halaman (nama, warna, ukuran terpilih)
  function productFromPage(extra){
    const t = (sel) => { const el = document.querySelector(sel); return el ? el.textContent.trim() : ''; };
    return Object.assign({ name: t('.product-info h3'), color: t('#colorValue'), size: t('#sizeValue') }, extra || {});
  }

  // 0812-3456-7890 dari 6281234567890
  function pretty(n){
    const local = '0' + String(n).replace(/^62/, '');
    return local.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
  }

  function apply(){
    document.querySelectorAll('a[data-wa]').forEach(a => {
      a.href = url(a.dataset.wa);
      a.target = '_blank'; a.rel = 'noopener';
    });
    document.querySelectorAll('a[data-wa-tel]').forEach(a => {
      a.href = 'tel:+' + CONFIG.number;
      a.textContent = pretty(CONFIG.number);
    });
    document.querySelectorAll('[data-wa-text]').forEach(el => { el.textContent = pretty(CONFIG.number); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();

  window.HilosWA = { config: CONFIG, url, open, productFromPage, pretty, apply };
})();
