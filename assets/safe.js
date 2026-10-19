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
  window.HilosSafe = { esc: esc, url: url, hex: hex, youtube: youtube };
})();
