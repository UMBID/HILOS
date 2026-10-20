  /* HILOS — transisi halaman: garis progres tipis + fade halus antar halaman.
    Ringan, tanpa library, dan otomatis mati bila pengunjung memilih "kurangi gerakan".
    Intro animasi HILOS (sekali per sesi, hanya di Beranda) mati secara default:
    ubah INTRO menjadi true untuk menyalakannya. */
  (function(){
    'use strict';
    var INTRO = false;

    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var css = ''
      + '#hxBar{position:fixed;top:0;left:0;height:3px;width:0;z-index:99999;pointer-events:none;'
      + 'background:linear-gradient(90deg,#6fa3d4,#2f6fb1);box-shadow:0 0 8px rgba(47,111,177,.55);opacity:0;'
      + 'transition:width .5s cubic-bezier(.2,.8,.2,1),opacity .25s ease;}'
      + '#hxBar.on{opacity:1;}'
      + 'body.hx-leave{opacity:0;transition:opacity .18s ease;}'
      + (reduce ? '' : '@keyframes hxIn{from{opacity:0}to{opacity:1}}body{animation:hxIn .35s ease backwards;}')
      + '#hxIntro{position:fixed;inset:0;z-index:100000;background:#0d1b2a;display:flex;align-items:center;justify-content:center;'
      + 'transition:opacity .5s ease,visibility .5s;}'
      + '#hxIntro.out{opacity:0;visibility:hidden;}'
      + '#hxIntro span{color:#eaf1f8;font:800 clamp(34px,8vw,64px)/1 "Archivo",system-ui,sans-serif;letter-spacing:.32em;margin-right:-.32em;'
      + 'opacity:0;transform:translateY(10px);animation:hxLet .6s cubic-bezier(.16,.84,.44,1) forwards;}'
      + '@keyframes hxLet{to{opacity:1;transform:none}}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    var bar = document.createElement('div'); bar.id = 'hxBar'; bar.setAttribute('aria-hidden', 'true');
    function mount(){ if (!bar.parentNode) document.body.appendChild(bar); }
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

    function reset(){
      document.body.classList.remove('hx-leave');
      bar.classList.remove('on'); bar.style.width = '0';
    }
    window.addEventListener('pageshow', reset); // tombol Back / bfcache

    function internal(a, e){
      if (!a || !a.href || e.defaultPrevented) return false;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
      if (a.target && a.target !== '_self') return false;
      if (a.hasAttribute('download') || a.hasAttribute('data-no-transition')) return false;
      var u;
      try { u = new URL(a.href, location.href); } catch (_) { return false; }
      if (u.origin !== location.origin || !/^https?:$/.test(u.protocol)) return false;
      if (u.pathname === location.pathname && u.search === location.search) return false; // anchor di halaman yang sama
      return true;
    }

    document.addEventListener('click', function(e){
      var a = e.target.closest && e.target.closest('a');
      if (!internal(a, e)) return;
      mount();
      bar.classList.add('on');
      requestAnimationFrame(function(){ bar.style.width = '78%'; });
      if (!reduce){
        e.preventDefault();
        document.body.classList.add('hx-leave');
        var href = a.href;
        setTimeout(function(){ location.href = href; }, 170);
      }
    });

    /* Intro HILOS: sekali per sesi, hanya di Beranda */
    if (INTRO && !reduce){
      try {
        var p = location.pathname;
        var isHome = /(^|\/)(index\.html)?$/.test(p);
        if (isHome && !sessionStorage.getItem('hx-intro')){
          sessionStorage.setItem('hx-intro', '1');
          var o = document.createElement('div'); o.id = 'hxIntro'; o.setAttribute('aria-hidden', 'true');
          'HILOS'.split('').forEach(function(ch, i){ var s = document.createElement('span'); s.textContent = ch; s.style.animationDelay = (i * 0.08) + 's'; o.appendChild(s); });
          (document.body || document.documentElement).appendChild(o);
          setTimeout(function(){ o.classList.add('out'); setTimeout(function(){ o.remove(); }, 600); }, 1100);
        }
      } catch (_) {}
    }
  })();


  /* Menu mobile (semua halaman): buka/tutup dengan tombol hamburger */
  (function(){
    var nav = document.querySelector('nav.nav'), t = document.querySelector('.nav-toggle');
    if (!nav || !t || t.__hilosNav) return;
    t.__hilosNav = true;
    t.setAttribute('aria-expanded', 'false');
    function set(o){ nav.classList.toggle('menu-open', o); t.setAttribute('aria-expanded', o ? 'true' : 'false'); }
    t.addEventListener('click', function(e){ e.stopPropagation(); set(!nav.classList.contains('menu-open')); });
    nav.addEventListener('click', function(e){ if (e.target.closest && e.target.closest('.nav-links a')) set(false); });
    document.addEventListener('click', function(e){ if (!nav.contains(e.target)) set(false); });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') set(false); });
    window.addEventListener('resize', function(){ if (window.innerWidth > 1023) set(false); });
  })();


  /* Pratinjau dari Admin: halaman dibuka di iframe dengan ?preview=1 dan menerima draft konten lewat postMessage */
  (function(){
    if (!/[?&]preview=1/.test(location.search) || window.parent === window) return;
    window.addEventListener('message', function(e){
      if (e.origin !== location.origin) return;
      var m = e.data; if (!m || m.type !== 'hilos-preview') return;
      if (m.data){ window.__hilosDraft = true; if (typeof window.__hilosApply === 'function') window.__hilosApply(m.data); }
      if (m.scroll){ var el = document.querySelector(m.scroll); if (el) el.scrollIntoView({ block:'start' }); }
    });
    function ready(){ try { window.parent.postMessage({ type:'hilos-preview-ready' }, location.origin); } catch (_) {} }
    if (document.readyState === 'complete') ready(); else window.addEventListener('load', ready);
  })();
