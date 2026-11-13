/* Ankara İş İlanı — site davranışı
   1) çerez onayı (Consent Mode v2: varsayılan ret, onayla güncelle)
   2) ölçüm olayları → dataLayer (GTM buradan okur)
   3) menü, sayaç, görünürlük, süzgeç, ilan formu */
(function () {
  'use strict';
  var d = document, w = window;
  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  /* Her olaya benzersiz kimlik: tarayıcı (piksel) ve ileride sunucu (CAPI) aynı olayı tekilleştirebilsin */
  function yeniId() {
    try { if (w.crypto && w.crypto.randomUUID) return w.crypto.randomUUID(); } catch (e) {}
    return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
  }
  function olay(ad, veri, sonra) {
    var o = { event: ad, olay_id: yeniId() };
    for (var k in (veri || {})) o[k] = veri[k];
    if (sonra) {
      /* sayfa değiştiren tıklama: GTM etiketleri çalışınca (ya da en geç 1 sn sonra) devam et; aksi hâlde
         yeni sayfaya geçiş isteği keser ve olay GA4'e hiç ulaşmaz (13.11.2026 canlı testle görüldü) */
      var bitti = false, devam = function () { if (!bitti) { bitti = true; sonra(); } };
      o.eventCallback = devam; o.eventTimeout = 1000;
      setTimeout(devam, 1200);
    }
    w.dataLayer.push(o);
  }
  function ayniSekmeGecis(e, a) {
    var h = a.getAttribute('href') || '';
    return h && h.charAt(0) !== '#' && h.indexOf('mailto:') !== 0 && h.indexOf('tel:') !== 0 && !a.target &&
      e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented;
  }
  d.documentElement.classList.remove('js-yok');
  var azaltilmis = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EPOSTA = 'info@ankaraisilani.com';

  /* ilk giriş kaynağı (UTM + fbclid/gclid varlığı) oturum boyunca saklanır; ilan formu e-tabloya "Kaynak" olarak yazar */
  (function () {
    try {
      var q = new URLSearchParams(w.location.search), p = [];
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) { if (q.get(k)) p.push(k.slice(4) + '=' + q.get(k).slice(0, 60)); });
      if (q.get('fbclid')) p.push('fbclid');
      if (q.get('gclid')) p.push('gclid');
      if (p.length && !w.sessionStorage.getItem('aii_kaynak')) w.sessionStorage.setItem('aii_kaynak', p.join(' · '));
      if (!w.sessionStorage.getItem('aii_kaynak') && d.referrer && d.referrer.indexOf(w.location.host) < 0)
        w.sessionStorage.setItem('aii_kaynak', 'yönlendiren=' + d.referrer.split('/')[2]);
    } catch (e) {}
  })();
  function ilkKaynak() { try { return w.sessionStorage.getItem('aii_kaynak') || 'doğrudan'; } catch (e) { return 'doğrudan'; } }

  /* ——— 1. çerez onayı ——— */
  var kutu = d.getElementById('cerez');
  function izinVer(hepsi) {
    var v = hepsi ? 'granted' : 'denied';
    gtag('consent', 'update', { ad_storage: v, ad_user_data: v, ad_personalization: v, analytics_storage: v });
  }
  function kaydet(secim) {
    try { localStorage.setItem('aii_cerez', secim); } catch (e) {}
    izinVer(secim === 'hepsi');
    if (kutu) kutu.classList.remove('goster');
    olay('cerez_tercihi', { cerez_secim: secim });
  }
  var kayitli = null;
  try { kayitli = localStorage.getItem('aii_cerez'); } catch (e) {}
  if (!kayitli && kutu) kutu.classList.add('goster');
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cerez]');
    if (b) { e.preventDefault(); kaydet(b.getAttribute('data-cerez')); }
    var ac = e.target.closest('[data-cerez-ac]');
    if (ac && kutu) { e.preventDefault(); kutu.classList.add('goster'); }
  });

  /* ——— 2. ölçüm olayları ——— */
  d.addEventListener('click', function (e) {
    var a = e.target.closest('a,button');
    if (!a) return;
    var yer = a.getAttribute('data-yer') || '';
    if (a.hasAttribute('data-ilan-ver')) {
      var veri = { tikla_yeri: a.getAttribute('data-ilan-ver') || yer };
      if (ayniSekmeGecis(e, a)) {
        e.preventDefault();
        var hedef = a.href;
        olay('ilan_ver_tikla', veri, function () { w.location.href = hedef; });
      } else olay('ilan_ver_tikla', veri);
    }
    var h = a.getAttribute('href') || '';
    if (h.indexOf('mailto:') === 0) olay('eposta_tikla', { tikla_yeri: yer });
    if (a.hasAttribute('data-sosyal')) olay('sosyal_tikla', { ag: a.getAttribute('data-sosyal') });
  });

  /* ——— menü ——— */
  var ust = d.querySelector('.ust');
  var dugme = d.querySelector('.menu-dugme');
  if (ust && dugme) {
    var menuKapat = function (odak) {
      ust.classList.remove('menu-acik');
      dugme.setAttribute('aria-expanded', 'false');
      d.documentElement.classList.remove('menu-kilit');
      if (odak) dugme.focus();
    };
    dugme.addEventListener('click', function () {
      var acik = ust.classList.toggle('menu-acik');
      dugme.setAttribute('aria-expanded', acik ? 'true' : 'false');
      d.documentElement.classList.toggle('menu-kilit', acik);
    });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ust.classList.contains('menu-acik')) menuKapat(true);
    });
    /* masaüstü genişliğine geçilirse perde kapanır, sayfa kaydırması geri gelir */
    if (w.matchMedia) {
      var genis = w.matchMedia('(min-width:980px)');
      var genisDegisti = function (m) { if (m.matches) menuKapat(false); };
      if (genis.addEventListener) genis.addEventListener('change', genisDegisti);
    }
  }

  /* ——— sayaç + görünürlük ——— */
  function sayiYaz(el, deger) {
    var ond = parseInt(el.getAttribute('data-ondalik') || '0', 10);
    el.textContent = deger.toLocaleString('tr-TR', { minimumFractionDigits: ond, maximumFractionDigits: ond }) + (el.getAttribute('data-son') || '');
  }
  function say(el) {
    var hedef = parseFloat(el.getAttribute('data-sayi'));
    if (azaltilmis || isNaN(hedef)) { sayiYaz(el, hedef); return; }
    var bas = null, sure = 1400;
    function adim(t) {
      if (bas === null) bas = t;
      var p = Math.min((t - bas) / sure, 1), e = 1 - Math.pow(1 - p, 3);
      sayiYaz(el, hedef * e);
      if (p < 1) requestAnimationFrame(adim); else sayiYaz(el, hedef);
    }
    requestAnimationFrame(adim);
  }
  if ('IntersectionObserver' in w) {
    var gozlem = new IntersectionObserver(function (liste) {
      liste.forEach(function (g) {
        if (!g.isIntersecting) return;
        var el = g.target;
        el.classList.add('gorundu');
        el.querySelectorAll && el.querySelectorAll('[data-sayi]').forEach(say);
        if (el.hasAttribute('data-sayi')) say(el);
        gozlem.unobserve(el);
      });
    }, { threshold: 0.25 });
    d.querySelectorAll('[data-goster],.adimlar,.erisim').forEach(function (el) { gozlem.observe(el); });
  } else {
    d.querySelectorAll('[data-goster]').forEach(function (el) { el.classList.add('gorundu'); });
    d.querySelectorAll('[data-sayi]').forEach(function (el) { sayiYaz(el, parseFloat(el.getAttribute('data-sayi'))); });
  }

  /* ——— açılır liste (arama + klavye) ——— */
  var trKucuk = function (t) { return String(t).toLocaleLowerCase('tr-TR'); };
  d.querySelectorAll('[data-acilir]').forEach(function (k) {
    var dugme = k.querySelector('.acilir-dugme'), deger = k.querySelector('.acilir-deger');
    var girdi = k.querySelector('input[type=hidden]'), panel = k.querySelector('.acilir-panel');
    var ara = k.querySelector('.acilir-ara input'), secenekler = [].slice.call(k.querySelectorAll('[role=option]'));
    function gorunen() { return secenekler.filter(function (o) { return !o.parentNode.hidden; }); }
    function ac() {
      panel.hidden = false; k.classList.add('acik'); dugme.setAttribute('aria-expanded', 'true');
      ara.value = ''; filtre(''); ara.focus();
    }
    function kapat(odak) {
      panel.hidden = true; k.classList.remove('acik'); dugme.setAttribute('aria-expanded', 'false');
      if (odak) dugme.focus();
    }
    function filtre(q) {
      q = trKucuk(q.trim());
      secenekler.forEach(function (o) { o.parentNode.hidden = q && trKucuk(o.textContent).indexOf(q) === -1; });
    }
    function sec(o) {
      girdi.value = o.getAttribute('data-deger');
      deger.textContent = o.textContent;
      k.classList.toggle('dolu', girdi.value !== 'hepsi');
      secenekler.forEach(function (x) { x.setAttribute('aria-selected', x === o ? 'true' : 'false'); });
      girdi.dispatchEvent(new Event('change', { bubbles: true }));
      var alan = k.closest('.alan'); if (alan) alan.classList.remove('hatali');
      kapat(true);
    }
    dugme.addEventListener('click', function () { panel.hidden ? ac() : kapat(true); });
    secenekler.forEach(function (o) { o.addEventListener('click', function () { sec(o); }); });
    ara.addEventListener('input', function () { filtre(ara.value); });
    k.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); kapat(true); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      if (panel.hidden) { ac(); return; }
      var g = gorunen(); if (!g.length) return;
      var i = g.indexOf(d.activeElement);
      if (e.key === 'ArrowDown') (g[i + 1] || g[0]).focus();
      else if (i <= 0) ara.focus(); else g[i - 1].focus();
    });
    d.addEventListener('click', function (e) { if (!panel.hidden && !k.contains(e.target)) kapat(false); });
  });

  /* ——— Genel İlanlar süzgeci ——— */
  var liste = d.querySelector('[data-suzulecek]');
  if (liste) {
    var sektor = 'hepsi', ilce = 'hepsi';
    var bos = d.querySelector('[data-bos]');
    var uygula = function () {
      var gorunen = 0;
      liste.querySelectorAll('[data-sektor]').forEach(function (s) {
        var uygun = (sektor === 'hepsi' || s.getAttribute('data-sektor') === sektor) && (ilce === 'hepsi' || s.getAttribute('data-ilce') === ilce);
        s.hidden = !uygun; if (uygun) gorunen++;
      });
      if (bos) bos.hidden = gorunen > 0;
    };
    d.querySelectorAll('[data-sektor-sec]').forEach(function (c) {
      c.addEventListener('click', function () {
        sektor = c.getAttribute('data-sektor-sec');
        d.querySelectorAll('[data-sektor-sec]').forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
        uygula();
      });
    });
    var sel = d.querySelector('[data-ilce-sec]');
    if (sel) sel.addEventListener('change', function () { ilce = sel.value; uygula(); });
  }

  /* ——— ilan verme formu ——— */
  var form = d.getElementById('ilan-formu');
  if (form) {
    var sonuc = d.getElementById('form-sonuc');
    var zorunlu = [['firma', 'Firma veya yetkili adını yazın.'], ['telefon', 'Size ulaşabileceğimiz bir telefon yazın.'], ['eposta', 'Geçerli bir e-posta adresi yazın.'], ['pozisyon', 'Aradığınız pozisyonu yazın.'], ['ilce', 'İlçeyi seçin.']];
    var isaretle = function (ad, hata) {
      var alan = form.querySelector('[name=' + ad + ']').closest('.alan');
      alan.classList.toggle('hatali', !!hata);
      var el = form.querySelector('[name=' + ad + ']');
      if (hata) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
      var h = alan.querySelector('.hata'); if (h && hata) h.textContent = hata;
    };
    var gonderiliyor = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ilkHata = null;
      zorunlu.forEach(function (z) {
        var v = (form.elements[z[0]].value || '').trim();
        var kotu = !v;
        if (z[0] === 'eposta' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) kotu = true;
        if (z[0] === 'telefon' && v && v.replace(/\D/g, '').length < 10) kotu = true;
        isaretle(z[0], kotu ? z[1] : '');
        if (kotu && !ilkHata) ilkHata = form.elements[z[0]];
      });
      var onay = form.elements.kvkk;
      var onayAlan = onay.closest('.alan');
      onayAlan.classList.toggle('hatali', !onay.checked);
      if (!onay.checked && !ilkHata) ilkHata = onay;
      if (ilkHata) {
        var hedef = ilkHata.type === 'hidden' ? ilkHata.closest('.alan').querySelector('.acilir-dugme') : ilkHata;
        hedef.focus(); return;
      }
      var f = form.elements;
      var secili = function (ad) { var x = form.querySelector('[name=' + ad + ']:checked'); return x ? x.value : 'Belirtilmedi'; };
      /* İlan sitenin sunucusuna gider ve e-tabloya yazılır (12.11.2026: e-posta yolu kaldırıldı).
         ilan_ver_gonder ölçümü YALNIZ kayıt başarılı olunca gönderilir. */
      if (gonderiliyor) return;
      gonderiliyor = true;
      var dugme = form.querySelector('button[type=submit]');
      var dugmeMetni = dugme.innerHTML;
      dugme.disabled = true; dugme.textContent = 'Gönderiliyor…';
      sonuc.classList.remove('goster', 'hata-sonuc');
      var veri = {
        firma: f.firma.value.trim(), telefon: f.telefon.value.trim(), eposta: f.eposta.value.trim(),
        pozisyon: f.pozisyon.value.trim(), ilce: f.ilce.value, calisma: secili('calisma'), sigorta: secili('sigorta'),
        ucret: f.ucret.value.trim(), aciklama: f.aciklama.value.trim(), kvkk: onay.checked,
        web_sitesi: f.web_sitesi ? f.web_sitesi.value : '', kaynak: ilkKaynak()
      };
      var bitir = function (tamam) {
        gonderiliyor = false;
        dugme.disabled = false; dugme.innerHTML = dugmeMetni;
        sonuc.innerHTML = tamam
          ? '<strong>İlanınız bize ulaştı.</strong>Kontrol edip sitemizde ve sosyal medya hesaplarımızda yayınlayacağız. Gerekirse verdiğiniz telefondan size ulaşırız.'
          : '<strong>İlanınız gönderilemedi.</strong>Lütfen birkaç dakika sonra tekrar deneyin. Sorun sürerse Facebook sayfamızdan bize mesaj gönderin.';
        sonuc.classList.toggle('hata-sonuc', !tamam);
        sonuc.classList.add('goster');
        sonuc.focus();
        if (tamam) form.reset();
      };
      fetch('/api/ilan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return r.ok && j.ok; }); })
        .then(function (tamam) {
          if (tamam) olay('ilan_ver_gonder', { pozisyon_ilce: veri.ilce, calisma_sekli: veri.calisma });
          bitir(tamam);
        })
        .catch(function () { bitir(false); });
    });
    form.addEventListener('input', function (e) {
      var alan = e.target.closest('.alan'); if (alan) alan.classList.remove('hatali');
    });
    /* huni ölçümü: işveren forma ilk kez dokunduğunda bir kez "ilan_formu_basla" */
    var formBasladi = false;
    form.addEventListener('focusin', function () {
      if (formBasladi) return;
      formBasladi = true;
      olay('ilan_formu_basla', {});
    });
  }
  /* ——— ilana başvuru formu (12.11.2026) ———
     Başvuru sitenin sunucusuna gider ve e-tabloya yazılır (e-posta yok). basvuru_tikla ölçümü
     (Meta "Contact" + GA4) YALNIZ kayıt başarılı olunca gönderilir; eski davranış (butona tıklayınca) kaldırıldı. */
  var bform = d.getElementById('basvuru-form');
  if (bform) {
    var bsonuc = d.getElementById('basvuru-sonuc');
    var bzorunlu = [['ad', 'Adınızı ve soyadınızı yazın.'], ['telefon', 'Size ulaşabileceğimiz bir telefon yazın.']];
    var bisaret = function (ad, hata) {
      var el = bform.querySelector('[name=' + ad + ']');
      var alan = el.closest('.alan');
      alan.classList.toggle('hatali', !!hata);
      if (hata) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
      var h = alan.querySelector('.hata'); if (h && hata) h.textContent = hata;
    };
    var bgonderiliyor = false;
    bform.addEventListener('submit', function (e) {
      e.preventDefault();
      var ilkHata = null;
      bzorunlu.forEach(function (z) {
        var v = (bform.elements[z[0]].value || '').trim();
        var kotu = !v;
        if (z[0] === 'ad' && v && v.length < 3) kotu = true;
        if (z[0] === 'telefon' && v && v.replace(/\D/g, '').length < 10) kotu = true;
        bisaret(z[0], kotu ? z[1] : '');
        if (kotu && !ilkHata) ilkHata = bform.elements[z[0]];
      });
      var bonay = bform.elements.kvkk;
      bonay.closest('.alan').classList.toggle('hatali', !bonay.checked);
      if (!bonay.checked && !ilkHata) ilkHata = bonay;
      if (ilkHata) { ilkHata.focus(); return; }
      if (bgonderiliyor) return;
      bgonderiliyor = true;
      var bdugme = bform.querySelector('button[type=submit]');
      var bdugmeMetni = bdugme.innerHTML;
      bdugme.disabled = true; bdugme.textContent = 'Gönderiliyor…';
      bsonuc.classList.remove('goster', 'hata-sonuc');
      var bf = bform.elements;
      var bveri = {
        ilan_kodu: bform.getAttribute('data-ilan-kodu'), ilan_baslik: bform.getAttribute('data-ilan-baslik'),
        ad: bf.ad.value.trim(), telefon: bf.telefon.value.trim(), not: bf.not.value.trim(), kvkk: bonay.checked,
        web_sitesi: bf.web_sitesi ? bf.web_sitesi.value : '', kaynak: ilkKaynak()
      };
      var bbitir = function (tamam) {
        bgonderiliyor = false;
        bdugme.disabled = false; bdugme.innerHTML = bdugmeMetni;
        bsonuc.innerHTML = tamam
          ? '<strong>Başvurunuz bize ulaştı.</strong>Başvurunuzu işverene iletiyoruz. Uygun görülürse verdiğiniz telefondan sizinle iletişime geçilir.'
          : '<strong>Başvurunuz gönderilemedi.</strong>Lütfen birkaç dakika sonra tekrar deneyin. Sorun sürerse Facebook sayfamızdan bize mesaj gönderin.';
        bsonuc.classList.toggle('hata-sonuc', !tamam);
        bsonuc.classList.add('goster');
        bsonuc.focus();
        if (tamam) bform.reset();
      };
      fetch('/api/basvuru', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bveri) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return r.ok && j.ok; }); })
        .then(function (tamam) {
          if (tamam) olay('basvuru_tikla', { ilan_kodu: bveri.ilan_kodu });
          bbitir(tamam);
        })
        .catch(function () { bbitir(false); });
    });
    bform.addEventListener('input', function (e) {
      var alan = e.target.closest('.alan'); if (alan) alan.classList.remove('hatali');
    });
  }
})();
