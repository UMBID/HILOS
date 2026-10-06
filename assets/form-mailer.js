/* Mengirim isi form (Kontak / Kerjasama) ke email lewat Web3Forms.
   Pemakaian: HilosForm.init({ formId, successId, kind }) */
(function(){
  const ENDPOINT = 'https://api.web3forms.com/submit';
  const COOLDOWN_MS = 20000;
  let lastSent = 0;

  function labelOf(el){
    if (el.tagName === 'TEXTAREA') return 'Pesan';
    if (el.tagName === 'SELECT') return (el.options[0] && el.options[0].textContent.trim()) || 'Pilihan';
    return (el.getAttribute('placeholder') || el.name || 'Isian').trim();
  }

  function init(opts){
    const form = document.getElementById(opts.formId);
    const okBox = document.getElementById(opts.successId);
    if (!form) return;

    // kotak error (dibuat otomatis)
    let errBox = form.parentElement.querySelector('.form-error');
    if (!errBox){
      errBox = document.createElement('div');
      errBox.className = 'form-error';
      errBox.style.cssText = 'display:none;margin-top:14px;padding:12px 14px;background:#fbeeea;border:1px solid #e3b5a6;color:#8a3a1f;font-size:12.5px;line-height:1.5;';
      okBox.insertAdjacentElement('afterend', errBox);
    }
    // jebakan bot (disembunyikan dari manusia)
    const trap = document.createElement('input');
    trap.type = 'checkbox'; trap.name = 'botcheck'; trap.tabIndex = -1; trap.autocomplete = 'off';
    trap.style.cssText = 'position:absolute;left:-9999px;opacity:0;pointer-events:none;';
    form.appendChild(trap);

    const btn = form.querySelector('button[type="submit"]');
    const btnLabel = btn ? btn.innerHTML : '';

    function showError(msg){
      okBox.classList.remove('show');
      const wa = (window.HILOS_FORM && window.HILOS_FORM.whatsapp) || '#';
      errBox.innerHTML = msg + ' Anda juga bisa menghubungi kami lewat <a href="' + wa + '" target="_blank" rel="noopener" style="color:inherit;font-weight:700;">WhatsApp</a>.';
      errBox.style.display = 'block';
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.style.display = 'none';
      okBox.classList.remove('show');
      if (trap.checked) return; // bot

      const cfg = window.HILOS_FORM || {};
      if (!cfg.accessKey || /^ISI_/.test(cfg.accessKey)){
        console.error('HILOS form: accessKey belum diisi di assets/form-config.js');
        showError('Formulir belum aktif (konfigurasi email belum diisi).');
        return;
      }
      if (Date.now() - lastSent < COOLDOWN_MS){
        showError('Mohon tunggu sebentar sebelum mengirim pesan lagi.');
        return;
      }

      // kumpulkan isian apa adanya (label = placeholder / pilihan pertama)
      const fields = Array.from(form.querySelectorAll('input:not([type=checkbox]):not([type=submit]), select, textarea'));
      const payload = {
        access_key: cfg.accessKey,
        from_name: 'Website HILOS',
        subject: '[HILOS ' + opts.kind + '] Pesan baru dari website'
      };
      let name = '';
      fields.forEach((el, i) => {
        const val = (el.value || '').trim();
        if (!val) return;
        const label = labelOf(el);
        if (el.type === 'email'){ payload.email = val; return; }
        if (i === 0 && el.type === 'text'){ name = val; payload.name = val; return; }
        payload[label] = val;
      });
      if (name) payload.subject = '[HILOS ' + opts.kind + '] Pesan baru dari ' + name;
      payload.Halaman = opts.kind;

      if (btn){ btn.disabled = true; btn.innerHTML = '<span>Mengirim...</span>'; }
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        });
        const out = await res.json().catch(() => ({}));
        if (res.ok && out.success){
          lastSent = Date.now();
          okBox.classList.add('show');
          form.reset();
        } else {
          console.error('HILOS form gagal:', res.status, out);
          showError('Maaf, pesan belum terkirim' + (out.message ? ' (' + out.message + ')' : '') + '.');
        }
      } catch (err){
        console.error('HILOS form error:', err);
        showError('Maaf, koneksi bermasalah dan pesan belum terkirim.');
      } finally {
        if (btn){ btn.disabled = false; btn.innerHTML = btnLabel; }
      }
    });
  }

  window.HilosForm = { init };
})();
