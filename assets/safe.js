/* HILOS - helper keamanan: semua teks/URL dari database melewati ini sebelum masuk ke halaman */
(function(){
  var MAP = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;' };
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"'`]/g, function(c){ return MAP[c]; }); }
  /* hanya izinkan http(s) dan path relatif; selain itu -> '' */
  function url(v){
    v = String(v == null ? '' : v).trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    if (/^(\.\/|\.\.\/|\/)?[\w\-\/.%]+(\?[^\s]*)?$/.test(v) && !/^[a-z][a-z0-9+.\-]*:/i.test(v)) return v;
    return '';
  }
  /* warna hex (#rgb/#rrggbb) saja -> aman dipakai di atribut style */
  function hex(v){ v = String(v == null ? '' : v).trim(); return /^#[0-9a-f]{3,8}$/i.test(v) ? v : '#cccccc'; }
  function youtube(v){ v = String(v == null ? '' : v); var m = v.match(/^https:\/\/(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i); return m ? v : ''; }
  /* teks dari admin -> elemen bertanda data-t="nama" (textContent, bukan HTML).
     Kunci tidak ada = pakai teks bawaan halaman. Kunci ada tapi kosong = teks DISEMBUNYIKAN (sengaja dikosongkan admin). */
  function hide(n, on){
    if (!n) return;
    if (on){ if (n.getAttribute('data-th') !== '1'){ n.setAttribute('data-th', '1'); n.setAttribute('data-thd', n.style.display || ''); } n.style.display = 'none'; }
    else if (n.getAttribute('data-th') === '1'){ n.style.display = n.getAttribute('data-thd') || ''; n.removeAttribute('data-th'); n.removeAttribute('data-thd'); }
  }
  function teks(obj, root){
    if (!obj || typeof obj !== 'object') return;
    (root || document).querySelectorAll('[data-t]').forEach(function(el){
      var k = el.getAttribute('data-t');
      if (!Object.prototype.hasOwnProperty.call(obj, k)) return;
      var v = obj[k];
      if (typeof v !== 'string') return;
      v = v.trim();
      if (v) el.textContent = v.slice(0, 400); else el.textContent = '';
      var par = el.parentElement, tgt = el;
      // tombol/link yang isinya hanya teks ini ikut disembunyikan, supaya tidak tersisa kotak kosong
      if (par && (par.tagName === 'A' || par.tagName === 'BUTTON') && par.children.length === 1 && el.tagName === 'SPAN') tgt = par;
      hide(tgt, !v);
      var nx = el.nextElementSibling; if (nx && nx.tagName === 'BR') hide(nx, !v);
    });
  }
  window.HilosSafe = { esc: esc, url: url, hex: hex, youtube: youtube, teks: teks };
})();
