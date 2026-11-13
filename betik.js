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
  function olay(ad, veri) {
    var o = { event: ad, olay_id: yeniId() };
    for (var k in (veri || {})) o[k] = veri[k];
    w.dataLayer.push(o);
  }
  /* Sayfa değiştiren tıklamada olay geçiş sırasında GA4'e ulaşmıyordu (13.11.2026 canlı test: dataLayer'da var,
     GA4 isteği yok). Çözüm: tıklamada not al, olayı VARILAN sayfada gönder. */
  function notAl(ad, veri) { try { sessionStorage.setItem('aii_bekleyen_olay', JSON.stringify({ ad: ad, veri: veri, z: Date.now() })); return true; } catch (e) { return false; } }
  function ayniSekmeGecis(e, a) {
    var h = a.getAttribute('href') || '';
    return h && h.charAt(0) !== '#' && !a.target && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
  }
  (function () {
    try {
      var b = JSON.parse(sessionStorage.getItem('aii_bekleyen_olay') || 'null');
      sessionStorage.removeItem('aii_bekleyen_olay');
      if (b && Date.now() - b.z < 60000) olay(b.ad, b.veri);
    } catch (e) {}
  })();
  d.documentElement.classList.remove('js-yok');
  /* Çerezsiz ziyaret sayacı (Vercel Web Analytics, 13.11.2026): reklamdan gelişte kaynak ve kampanya özel olay olarak
     kaydedilir (UTM kırılımı ücretli eklenti istediği için). Kişisel veri yok; yalnız bağlantıdaki etiket. */
  (function () {
    try {
      var q = new URLSearchParams(w.location.search), k = q.get('utm_source'), c = q.get('utm_campaign');
      if ((k || c || q.get('fbclid')) && w.va) w.va('event', { name: 'reklam_girisi', data: { kaynak: (k || (q.get('fbclid') ? 'facebook (fbclid)' : '')).slice(0, 60), kampanya: (c || '').slice(0, 60) } });
    } catch (e) {}
  })();
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
    /* AdSense: onay yoksa kişiselleştirilmemiş reklam (Google: support.google.com/adsense/answer/7670312) */
    try { (w.adsbygoogle = w.adsbygoogle || []).requestNonPersonalizedAds = hepsi ? 0 : 1; } catch (e) {}
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
      if (!(ayniSekmeGecis(e, a) && notAl('ilan_ver_tikla', veri))) olay('ilan_ver_tikla', veri);
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
    var zorunlu = [['firma', 'Firma veya yetkili adını yazın.'], ['telefon', 'Size ulaşabileceğimiz bir telefon yazın.'], ['eposta', 'Geçerli bir e-posta adresi yazın.'], ['pozisyon', 'Aradığınız pozisyonu yazın.'], ['ilce', 'İlçeyi seçin.'], ['aciklama', 'İş tanımını ve şartları yazın (en az 20 karakter).']];
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
        if (z[0] === 'aciklama' && v && v.length < 20) kotu = true;
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
          if (tamam) {
            var gv = { pozisyon_ilce: veri.ilce, calisma_sekli: veri.calisma };
            /* başarılı gönderim → teşekkür sayfası; ilan_ver_gonder (GA4 + Meta Lead) orada gönderilir */
            if (notAl('ilan_ver_gonder', gv)) { w.location.href = '/ilan-gonderildi'; return; }
            olay('ilan_ver_gonder', gv);
          }
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
  /* ——— makale yorumları (13.11.2026) ———
     Liste /api/yorum'dan gelir (yalnız ekibin onayladığı yorumlar), metinler textContent ile yazılır. yorum_gonder ölçümü yalnız kayıt başarılıysa. */
  var ybolum = d.getElementById('yorum-alani');
  if (ybolum) {
    var yslug = ybolum.getAttribute('data-slug');
    var yliste = d.getElementById('yorum-liste');
    var yform = d.getElementById('yorum-form');
    var ysonuc = d.getElementById('yorum-sonuc');
    var ysayac = d.getElementById('yorum-sayac');
    var yAcilis = Date.now();
    var AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    var ytarih = function (t) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t || ''); return m ? (+m[3]) + ' ' + AYLAR[+m[2] - 1] + ' ' + m[1] : ''; };
    var ymetin = function (etiket, sinif, metin) { var e = d.createElement(etiket); if (sinif) e.className = sinif; e.textContent = metin; return e; };
    var yciz = function (liste) {
      yliste.textContent = '';
      if (!liste.length) { yliste.appendChild(ymetin('p', 'yorum-bos', 'Henüz yorum yok. İlk yorumu siz yazın.')); return; }
      liste.forEach(function (y) {
        var a = d.createElement('article'); a.className = 'yorum';
        var ust = d.createElement('p'); ust.className = 'yorum-ust';
        ust.appendChild(ymetin('strong', '', y.ad));
        var t = ytarih(y.tarih); if (t) ust.appendChild(ymetin('span', 'yorum-tarih', t));
        a.appendChild(ust); a.appendChild(ymetin('p', 'yorum-metin', y.yorum));
        if (y.yanit) { var yy = d.createElement('div'); yy.className = 'yorum-yanit'; yy.appendChild(ymetin('strong', '', 'Ankara İş İlanı ekibi')); yy.appendChild(ymetin('p', '', y.yanit)); a.appendChild(yy); }
        yliste.appendChild(a);
      });
    };
    fetch('/api/yorum?slug=' + encodeURIComponent(yslug))
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok) yciz(j.yorumlar || []); else yliste.textContent = ''; })
      .catch(function () { yliste.textContent = ''; });
    var yisaret = function (ad, hata) {
      var el = yform.querySelector('[name=' + ad + ']'); var alan = el.closest('.alan');
      alan.classList.toggle('hatali', !!hata);
      if (hata) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    };
    yform.elements.yorum.addEventListener('input', function () { ysayac.textContent = yform.elements.yorum.value.length + ' / 1000'; });
    yform.addEventListener('input', function (e) { var alan = e.target.closest('.alan'); if (alan) alan.classList.remove('hatali'); });
    var ygonderiliyor = false;
    yform.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = yform.elements, ilkHata = null;
      var adKotu = f.ad.value.trim().length < 2, yorumKotu = f.yorum.value.trim().length < 10;
      yisaret('ad', adKotu ? 'x' : ''); yisaret('yorum', yorumKotu ? 'x' : '');
      f.kvkk.closest('.alan').classList.toggle('hatali', !f.kvkk.checked);
      ilkHata = adKotu ? f.ad : (yorumKotu ? f.yorum : (!f.kvkk.checked ? f.kvkk : null));
      if (ilkHata) { ilkHata.focus(); return; }
      if (ygonderiliyor) return;
      ygonderiliyor = true;
      var dugme = yform.querySelector('button[type=submit]'), dugmeMetni = dugme.innerHTML;
      dugme.disabled = true; dugme.textContent = 'Gönderiliyor…';
      ysonuc.classList.remove('goster', 'hata-sonuc');
      var bitir = function (tamam, neden) {
        ygonderiliyor = false; dugme.disabled = false; dugme.innerHTML = dugmeMetni;
        var baslik = tamam ? 'Yorumunuz alındı.' : 'Yorumunuz gönderilemedi.';
        var ayrinti = tamam ? 'Ekibimiz kontrol ettikten sonra bu sayfada yayınlanır.'
          : (neden === 'baglanti' ? 'Yorumda bağlantı yer alamaz. Bağlantıyı kaldırıp tekrar gönderin.'
          : (neden === 'hiz' ? 'Kısa sürede çok fazla yorum gönderdiniz. Lütfen biraz sonra tekrar deneyin.'
          : 'Lütfen birkaç dakika sonra tekrar deneyin.'));
        ysonuc.textContent = ''; ysonuc.appendChild(ymetin('strong', '', baslik)); ysonuc.appendChild(d.createTextNode(ayrinti));
        ysonuc.classList.toggle('hata-sonuc', !tamam); ysonuc.classList.add('goster'); ysonuc.focus();
        if (tamam) { yform.reset(); ysayac.textContent = '0 / 1000'; }
      };
      fetch('/api/yorum', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        slug: yslug, ad: f.ad.value.trim(), yorum: f.yorum.value.trim(), kvkk: f.kvkk.checked,
        web_sitesi: f.web_sitesi ? f.web_sitesi.value : '', sure: Date.now() - yAcilis }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { tamam: r.ok && j.ok, neden: j.neden }; }); })
        .then(function (s) { if (s.tamam) olay('yorum_gonder', { makale: yslug }); bitir(s.tamam, s.neden); })
        .catch(function () { bitir(false); });
    });
  }
})();
