/* HILOS — statistik sederhana (tanpa cookie, tanpa data pribadi).
   Mencatat: kunjungan halaman, produk dilihat, klik WhatsApp -> tabel site_events (lihat supabase-stats.sql).
   Aman dimuat di semua halaman; kalau Supabase belum siap, diam saja. */
(function(){
  if (window.HilosTrack) return;
  var dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1';
  // jangan hitung kunjungan admin yang sedang login di browser yang sama
  var isAdmin = false;
  try { for (var i = 0; i < localStorage.length; i++){ var k = localStorage.key(i); if (/^sb-.*auth-token$/.test(k)) { isAdmin = true; break; } } } catch(e){}
  var off = dnt || isAdmin || location.protocol === 'file:';

  var sid = '';
  try { sid = sessionStorage.getItem('hilos_sid') || ''; if (!sid){ sid = Math.random().toString(36).slice(2, 12); sessionStorage.setItem('hilos_sid', sid); } } catch(e){ sid = 'x' + Math.random().toString(36).slice(2, 8); }

  var page = (location.pathname.split('/').pop() || 'index').replace(/\.html?$/, '') || 'index';
  var queue = [], client = null, tried = false;

  function seenOnce(key){
    try { if (sessionStorage.getItem(key)) return true; sessionStorage.setItem(key, '1'); } catch(e){}
    return false;
  }
  function flush(){
    if (!client) return;
    while (queue.length){
      var row = queue.shift();
      try { var r = client.from('site_events').insert(row); if (r && r.then) r.then(function(){}, function(){}); } catch(e){}
    }
  }
  function getClient(){
    if (client) return true;
    try { if (window.getSupabaseClient && window.supabase){ client = window.getSupabaseClient(); return !!client; } } catch(e){}
    return false;
  }
  function loadSupabase(){
    if (tried) return; tried = true;
    function add(src, cb){ var s = document.createElement('script'); s.src = src; s.onload = cb; s.onerror = function(){}; document.head.appendChild(s); }
    add('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', function(){ add('assets/supabase-config.js', function(){ if (getClient()) flush(); }); });
  }
  function send(row){
    if (off) return;
    row.sid = sid; row.page = row.page || page;
    queue.push(row);
    if (getClient()) flush(); else setTimeout(function(){ if (getClient()) flush(); else loadSupabase(); }, 900);
  }

  var api = {
    pageView: function(){ if (!seenOnce('t:pv:' + page)) send({ event:'page_view' }); },
    productView: function(p, src){
      if (!p || !(p.name || p.sku)) return;
      if (seenOnce('t:prv:' + (p.sku || p.name))) return;
      send({ event:'product_view', page:src || page, product_sku:p.sku || null, product_name:p.name || null });
    },
    wa: function(kind, data){
      var now = Date.now();
      if (api._lastWa && now - api._lastWa < 1500) return; api._lastWa = now;
      var d = data || {};
      send({ event:'wa_click', detail:kind || 'general', product_sku:d.sku || null, product_name:d.name || null });
    }
  };
  window.HilosTrack = api;

  function start(){ api.pageView(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
