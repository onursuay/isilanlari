#!/usr/bin/env node
/* Ankara İş İlanları — site üreteci (tek kaynak)
   veri/ilanlar.json  → Güncel İlanlar, Genel İlanlar, ilan sayfaları (JobPosting)
   veri/yazilar.json  → Ek İş İlanları ve Evde Paketleme İşi rehberleri (altbilgiden erişilir)
   Çalıştır: node _uret.mjs   |  Tasarım: stil.css + betik.js  |  Tasarım yönü: işveren önce (11.11.2026) */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const SITE = process.env.SITE_URL || 'https://ankaraisilani.com';
const GTM = 'GTM-KS8JNCLW';                 /* ankaraisilani.com kapsayıcısı (yalnız bu site) */
const EPOSTA = 'info@ankaraisilani.com';
const FB_SAYFA = 'https://www.facebook.com/ankaraisilanlaricomtr/';
const FB_GRUP = 'https://www.facebook.com/groups/ankaraisilanlari';
const INSTAGRAM = 'https://www.instagram.com/ankaraisilanlaricomtr/';
const LINKEDIN = 'https://www.linkedin.com/company/85396970/';

const oku = p => fs.readFileSync(path.join(KOK,p),'utf8');
const yaz = (p,s) => { fs.mkdirSync(path.dirname(path.join(KOK,p)),{recursive:true}); fs.writeFileSync(path.join(KOK,p),s); };
const ldGuvenli = o => JSON.stringify(o).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const kac = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const duz = s => String(s).replace(/<[^>]+>/g,'');
const TR = {'ç':'c','Ç':'c','ğ':'g','Ğ':'g','ı':'i','I':'i','İ':'i','ö':'o','Ö':'o','ş':'s','Ş':'s','ü':'u','Ü':'u'};
const slug = s => s.split('').map(c=>TR[c]??c).join('').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

const veri  = JSON.parse(oku('veri/ilanlar.json'));
const yazi  = JSON.parse(oku('veri/yazilar.json')).yazilar;
const ilanlar = [...veri.ilanlar].sort((a,b)=>b.tarih.localeCompare(a.tarih));
const bugun = veri.guncelleme;
const trTarih = t => new Date(t+'T00:00:00+03:00').toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'});
const ilanYol = i => `ilan/${slug(i.baslik)}-${i.kod.toLowerCase()}.html`;
const yaziYol = y => `yazi/${y.slug}.html`;
const kisalt = (t,n) => { t=String(t).trim(); if(t.length<=n) return t;
  const kes=t.slice(0,n); const bos=kes.lastIndexOf(' '); return (bos>n*0.6?kes.slice(0,bos):kes).replace(/[.,;:]$/,'')+'…'; };

const ILCELER = ['Akyurt','Altındağ','Ayaş','Bala','Beypazarı','Çamlıdere','Çankaya','Çubuk','Elmadağ','Etimesgut','Evren','Gölbaşı','Güdül','Haymana','Kahramankazan','Kalecik','Keçiören','Kızılcahamam','Mamak','Nallıhan','Polatlı','Pursaklar','Sincan','Şereflikoçhisar','Yenimahalle'];
const SEKTOR = {satis:'Satış',uretim:'Üretim',temizlik:'Temizlik',kurye:'Kurye',servis:'Servis',buro:'Ön büro'};

const KATEGORI = {
  'ek-is-ilanlari':   {dosya:'ek-is-ilanlari.html',  ad:'Ek İş İlanları',  anahtar:'ek iş ilanları',
    baslik:'Ek İş İlanları: Ankara\'da akşam ve hafta sonu ek iş',
    ozet:'Ankara\'da ek iş nerelerde çıkar, ne kadar kazandırır, nelere dikkat edilir? Düzenli yayınladığımız rehberler burada.',
    girisBaslik:'Mesai bitince başlayan işler',
    giris:'Ek iş, mevcut işinizin ya da okulunuzun üzerine akşam veya hafta sonu yaptığınız iştir. Bu bölümde ek iş arayanlar için yazdığımız rehberler var: iş hangi alanlarda çıkıyor, kazanç nasıl hesaplanır, hangi teklife mesafe konur. Güncel ilanları görmek için <a href="guncel-ilanlar.html">Güncel İlanlar</a> sayfasına bakın.'},
  'evde-paketleme-isi':{dosya:'evde-paketleme-isi.html', ad:'Evde Paketleme İşi', anahtar:'evde paketleme işi',
    baslik:'Evde Paketleme İşi: güvenilir mi, ne kadar kazandırır?',
    ozet:'Evde paketleme işi güvenilir mi, ücret talebi nasıl anlaşılır, fason paketleme gerçekte nasıl yürür? Koruyucu bilgilendirme yazıları.',
    girisBaslik:'Evde paketleme işi güvenilir mi?',
    giris:'Tek cümlelik cevap: <strong>işe başlamak için sizden ödeme isteniyorsa o süreç işe alım süreci değildir.</strong> Bu bölümde ücret talebine dayanan tekliflerin işaretlerini, fason paketleme işinin gerçekte nasıl yürüdüğünü ve mağdur olunca izlenecek yolu yazıyoruz. Bu sayfalar bilgilendirmedir, iş vaadi içermez.'}
};

/* ——— simgeler ——— */
const IK = {
  is:`<svg viewBox="0 0 24 24" fill="none" stroke="#8A5A00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></svg>`,
  kisi:`<svg viewBox="0 0 24 24" fill="none" stroke="#2630C4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
  tik:`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  ok:`<svg class="ok" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  para:`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M14.8 9.2c-.5-.8-1.5-1.2-2.8-1.2-1.6 0-2.8.8-2.8 2s1.1 1.7 2.8 2 2.8.8 2.8 2-1.2 2-2.8 2c-1.3 0-2.3-.4-2.8-1.2M12 6.5V8m0 8v1.5"/></svg>`,
  yayin:`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12"/></svg>`,
  kalkan:`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>`,
  posta:`<svg viewBox="0 0 24 24" fill="none" stroke="#3B46F2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>`,
  fb:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-7.2h2.4l.4-2.9h-2.8V9.1c0-.8.2-1.4 1.4-1.4h1.5V5.1c-.3 0-1.1-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.1H8.1v2.9h2.4V21z"/></svg>`,
  ig:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7.3A4.7 4.7 0 1 0 12 16.7 4.7 4.7 0 0 0 12 7.3zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM17.2 6.1a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zM16 3H8a5 5 0 0 0-5 5v8a5 5 0 0 0 5 5h8a5 5 0 0 0 5-5V8a5 5 0 0 0-5-5zm3.3 13a3.3 3.3 0 0 1-3.3 3.3H8A3.3 3.3 0 0 1 4.7 16V8A3.3 3.3 0 0 1 8 4.7h8A3.3 3.3 0 0 1 19.3 8z"/></svg>`,
  in:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 8.6a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8zM3.6 10.2h3.2V20H3.6zM9.1 10.2h3v1.3c.5-.9 1.6-1.6 3.1-1.6 3.2 0 3.8 2.1 3.8 4.8V20h-3.2v-4.6c0-1.1 0-2.5-1.5-2.5s-1.8 1.2-1.8 2.4V20H9.1z"/></svg>`,
  grup:`<svg viewBox="0 0 24 24" fill="none" stroke="#3B46F2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.3a6.5 6.5 0 0 1 3.5 5.7"/></svg>`
};

/* ——— ortak iskelet ——— */
const GOM = {baslik:'', ld:[]};
const sayfa = ({baslik,aciklama,yol,ld=[],k='',aktif='',govde,robots='index,follow,max-image-preview:large,max-snippet:-1'}) => `<!doctype html>
<html lang="tr" class="js-yok">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${kac(kisalt(baslik,60))}</title>
<meta name="description" content="${kac(kisalt(aciklama,155))}">
<link rel="canonical" href="${SITE}/${yol}">
<meta name="robots" content="${robots}">
<meta name="theme-color" content="#3B46F2">
<meta property="og:site_name" content="Ankara İş İlanları">
<meta property="og:type" content="website">
<meta property="og:title" content="${kac(baslik)}">
<meta property="og:description" content="${kac(kisalt(aciklama,155))}">
<meta property="og:locale" content="tr_TR">
<meta property="og:url" content="${SITE}/${yol}">
<meta property="og:image" content="${SITE}/medya/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="geo.region" content="TR-06">
<meta name="geo.placename" content="Ankara">
<link rel="icon" href="${k}medya/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${k}medya/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Poppins:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${k}stil.css">
<script>
/* Çerez onayı (Consent Mode v2): her şey reddedilmiş başlar, onayla güncellenir. GTM'den ÖNCE çalışmalıdır. */
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});
gtag('set','ads_data_redaction',true);
try{if(localStorage.getItem('aii_cerez')==='hepsi'){gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'})}}catch(e){}
</script>
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM}');</script>
${ld.map(x=>`<script type="application/ld+json">${ldGuvenli(x)}</script>`).join('\n')}
</head>
<body>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<a class="atla" href="#icerik">İçeriğe geç</a>
${ust(aktif,k)}
<main id="icerik">
${govde}
</main>
${alt(k)}
<script src="${k}betik.js" defer></script>
</body>
</html>`;

const MENU = [['ana','index.html','Ana Sayfa'],['guncel','guncel-ilanlar.html','Güncel İlanlar'],['genel','genel-ilanlar.html','Genel İlanlar'],['hakkimizda','hakkimizda.html','Hakkımızda'],['iletisim','iletisim.html','İletişim']];
const ust = (aktif,k='') => `<header class="ust">
  <div class="kap ust-ic">
    <a class="marka" href="${k}index.html" aria-label="Ankara İş İlanları, ana sayfa"><img src="${k}medya/logo.svg" width="44" height="44" alt=""></a>
    <nav class="menu" id="ana-menu" aria-label="Ana menü">
${MENU.map(([a,h,t])=>`      <a href="${k}${h}"${aktif===a?' aria-current="page"':''}>${t}</a>`).join('\n')}
    </nav>
    <div class="ust-sag">
      <a class="dugme dugme-sari dugme-kucuk" href="${k}ilan-ver.html" data-ilan-ver="ust">Ücretsiz ilan ver</a>
      <button class="menu-dugme" type="button" aria-label="Menüyü aç veya kapat" aria-expanded="false" aria-controls="ana-menu"><span></span></button>
    </div>
  </div>
</header>`;

const alt = (k='') => `<footer class="alt">
  <div class="kap">
    <div class="alt-izgara">
      <div class="alt-marka">
        <a href="${k}index.html" aria-label="Ankara İş İlanları, ana sayfa"><img src="${k}medya/logo.svg" width="52" height="52" alt=""></a>
        <p>Ankara'da iş arayanla eleman arayanı buluşturan ilan platformu. İlanlar yayından önce okunur, adaydan ücret isteyen ilan yayınlanmaz.</p>
        <div class="alt-sosyal">
          <a href="${FB_SAYFA}" rel="me noopener" target="_blank" aria-label="Facebook sayfamız" data-sosyal="facebook_sayfa">${IK.fb}</a>
          <a href="${INSTAGRAM}" rel="me noopener" target="_blank" aria-label="Instagram hesabımız" data-sosyal="instagram">${IK.ig}</a>
          <a href="${LINKEDIN}" rel="me noopener" target="_blank" aria-label="LinkedIn sayfamız" data-sosyal="linkedin">${IK.in}</a>
        </div>
      </div>
      <div>
        <h4>Platform</h4>
        <ul>
          <li><a href="${k}index.html">Ana Sayfa</a></li>
          <li><a href="${k}guncel-ilanlar.html">Güncel İlanlar</a></li>
          <li><a href="${k}genel-ilanlar.html">Genel İlanlar</a></li>
          <li><a href="${k}hakkimizda.html">Hakkımızda</a></li>
          <li><a href="${k}iletisim.html">İletişim</a></li>
          <li><a href="${k}ilan-ver.html" data-ilan-ver="alt">Ücretsiz İlan Ver</a></li>
        </ul>
      </div>
      <div>
        <h4>Rehberler</h4>
        <ul>
          <li><a href="${k}ek-is-ilanlari.html">Ek İş İlanları</a></li>
          <li><a href="${k}evde-paketleme-isi.html">Evde Paketleme İşi</a></li>
        </ul>
      </div>
      <div>
        <h4>İletişim</h4>
        <ul>
          <li><a href="mailto:${EPOSTA}" data-yer="alt">${EPOSTA}</a></li>
          <li><a href="${FB_GRUP}" rel="noopener" target="_blank" data-sosyal="facebook_grup">Facebook grubumuz</a></li>
          <li><a href="${k}gizlilik.html">Gizlilik ve KVKK</a></li>
          <li><a href="#" data-cerez-ac>Çerez tercihleri</a></li>
        </ul>
      </div>
    </div>
    <div class="alt-kunye">
      <span>© 2026 Ankara İş İlanları</span>
      <span>İş bulma vaadinde bulunmuyoruz, ilanları yayınlıyoruz.</span>
    </div>
  </div>
</footer>
<div class="cerez" id="cerez" role="dialog" aria-live="polite" aria-label="Çerez tercihleri">
  <p>Siteyi iyileştirmek ve ilan reklamlarımızın etkisini ölçmek için çerez kullanıyoruz. Yalnız gerekli olanlarla da devam edebilirsiniz. Ayrıntılar: <a href="${k}gizlilik.html">Gizlilik ve KVKK</a>.</p>
  <div class="cerez-dugme">
    <button class="dugme dugme-sari dugme-kucuk" type="button" data-cerez="hepsi">Tümünü kabul et</button>
    <button class="dugme dugme-hat-acik dugme-kucuk" type="button" data-cerez="gerekli">Yalnız gerekli olanlar</button>
  </div>
</div>`;

const yolIzi = (parcalar) => ({'@context':'https://schema.org','@type':'BreadcrumbList',
  itemListElement:parcalar.map((p,n)=>({'@type':'ListItem',position:n+1,name:p.ad,item:`${SITE}/${p.yol}`}))});
const ORG = {'@context':'https://schema.org','@type':'Organization',name:'Ankara İş İlanları',url:SITE,
  logo:`${SITE}/medya/logo.png`,email:EPOSTA,areaServed:{'@type':'City',name:'Ankara'},
  sameAs:[FB_SAYFA,INSTAGRAM,LINKEDIN,FB_GRUP],
  description:"Ankara'da iş arayanla eleman arayanı buluşturan ilan platformu. Adaydan ücret istenmez."};

const yolBas = (k,...parca) => `<nav class="yol-izi" aria-label="Sayfa yolu"><a href="${k}index.html">Ana Sayfa</a>${parca.map(p=>`<span>${p}</span>`).join('')}</nav>`;
const sayfaBas = ({yol,baslik,lead,eylem=''}) => `<section class="sayfa-bas">
  <div class="kap">
    ${yol}
    <h1>${baslik}</h1>
    ${lead?`<p class="lead">${lead}</p>`:''}
    ${eylem?`<div class="hero-eylem">${eylem}</div>`:''}
  </div>
</section>`;

const cagri = (k='',baslik='Ekibinize yeni biri mi lazım?',metin='İlanınızı bugün gönderin, kontrol edip yayınlayalım. İlan vermek ücretsizdir.') => `<section class="cagri">
  <div class="kap cagri-ic">
    <div>
      <h2>${baslik}</h2>
      <p>${metin}</p>
    </div>
    <a class="dugme dugme-sari" href="${k}ilan-ver.html" data-ilan-ver="cagri">Ücretsiz ilan verin ${IK.ok}</a>
  </div>
</section>`;

const satir = (i,k='') => { const sk = SEKTOR[i.kategori]||'İlan'; return `      <a class="ilan" href="${k}${ilanYol(i)}" data-sektor="${kac(i.kategori)}" data-ilce="${kac(i.ilce)}">
        <span class="ilan-etiket t-${kac(i.kategori)}" aria-hidden="true">${kac(sk)}</span>
        <span>
          <span class="ilan-baslik">${kac(i.baslik)}</span>
          <span class="ilan-alt"><span>${kac(i.ilce)}</span><span>${kac(i.calisma)}</span><span>${i.sigorta?'Sigortalı':'Sigorta belirtilmemiş'}</span><span>${trTarih(i.tarih)}</span></span>
        </span>
        <span class="ilan-rozet">✓ Ücret talebi yok</span>
      </a>`; };

const yaziKart = (y,k='') => `      <a class="kart" href="${k}${yaziYol(y)}">
        <span class="kart-ust">${KATEGORI[y.kategori].ad} · ${y.okuma} dakika</span>
        <h3>${kac(y.baslik)}</h3>
        <p>${kac(y.ozet)}</p>
        <span class="kart-ok">Yazıyı okuyun</span>
      </a>`;

const sssBlok = (sss) => !sss?.length ? '' : `
<section class="bolum">
  <div class="kap sss">
    <h2>Sık sorulanlar</h2>
    <div class="sc">
${sss.map((q,n)=>`      <details${n===0?' open':''}>
        <summary>${kac(q.s)}</summary>
        <p>${q.c}</p>
      </details>`).join('\n')}
    </div>
  </div>
</section>`;

/* ——— 1. ANA SAYFA ——— */
{
  const secilen = ilanlar.slice(0,3);
  const govde = `<section class="hero">
  <div class="kap hero-izgara">
    <div class="hero-metin">
      <h1>Ankara'da eleman arıyorsanız ilanınızı ücretsiz yayınlayalım</h1>
      <p class="lead">İlanınız sitemizde, Instagram'da ve Facebook sayfamızda yayınlanır. Topluluğumuzda 41 binden fazla üyeli bir Facebook grubu var.</p>
      <div class="hero-eylem">
        <a class="dugme dugme-sari" href="ilan-ver.html" data-ilan-ver="hero">Ücretsiz ilan verin ${IK.ok}</a>
        <a class="dugme dugme-hat" href="guncel-ilanlar.html">İş mi arıyorsunuz?</a>
      </div>
      <p class="hero-not"><b>Üyelik gerekmez.</b> Formu doldurmanız birkaç dakika sürer.</p>
    </div>
    <div class="sahne" aria-hidden="true">
      <svg class="sahne-yol" viewBox="0 0 560 515" preserveAspectRatio="none"><path class="cizgi" pathLength="420" d="M300 152 C 344 232, 218 292, 262 372"/></svg>
      <div class="sahne-kart sahne-isveren">
        <div class="sahne-etiket"><span class="sahne-ikon">${IK.is}</span><div><strong>Eleman aranıyor</strong><small>İşveren ilanı</small></div></div>
        <div class="sahne-etiketler"><span>Satış görevlisi</span><span>Çankaya</span><span>Tam zamanlı</span></div>
      </div>
      <div class="sahne-kart sahne-aday">
        <div class="sahne-etiket"><span class="sahne-ikon">${IK.kisi}</span><div><strong>İş arıyorum</strong><small>Aday başvurusu</small></div></div>
        <div class="sahne-etiketler"><span>Ankara</span><span>Hemen başlayabilir</span></div>
      </div>
      <div class="sahne-eslesme"><i>${IK.tik}</i>Buluştular</div>
      <span class="sahne-parca p1"></span><span class="sahne-parca p2"></span><span class="sahne-parca p3"></span>
    </div>
  </div>
</section>

<section class="erisim" aria-label="Topluluğumuz">
  <div class="kap erisim-izgara">
    <div class="erisim-oge"><span class="erisim-sayi" data-sayi="41" data-son=" bin+">41 bin+</span><span class="erisim-ad">üyeli Facebook grubu</span></div>
    <div class="erisim-oge"><span class="erisim-sayi" data-sayi="2.8" data-ondalik="1" data-son=" bin+">2,8 bin+</span><span class="erisim-ad">Facebook sayfası takipçisi</span></div>
    <div class="erisim-oge"><span class="erisim-sayi" data-sayi="2" data-son=" bin+">2 bin+</span><span class="erisim-ad">LinkedIn takipçisi</span></div>
  </div>
</section>

<section class="bolum">
  <div class="kap">
    <div class="bolum-bas" data-goster>
      <h2>İlanınız üç adımda yayında</h2>
      <p>Üyelik, ödeme ya da karmaşık bir panel yok. Bilgileri iletirsiniz, gerisini biz yürütürüz.</p>
    </div>
    <div class="adimlar">
      <div class="adim" data-goster="1"><div class="adim-no">1</div><h3>İlanı bize iletin</h3><p>Pozisyonu, çalışma yerini ve şartları kısa bir formla yazın.</p></div>
      <div class="adim" data-goster="2"><div class="adim-no">2</div><h3>Biz kontrol edip yayınlayalım</h3><p>Ücret talebi ve ayrımcı ifade gibi sorunları ayıklar, ilanı sitemizde, Instagram'da ve Facebook sayfamızda yayınlarız.</p></div>
      <div class="adim" data-goster="3"><div class="adim-no">3</div><h3>Adaylar size ulaşsın</h3><p>Adaylar ilan üzerinden başvurur, başvuruları size biz iletiriz.</p></div>
    </div>
  </div>
</section>

<section class="bolum bolum-yuzey">
  <div class="kap">
    <div class="bolum-bas" data-goster>
      <h2>İşverenler için ne yapıyoruz</h2>
    </div>
    <div class="sunu">
      <div class="sunu-kutu sunu-buyuk" data-goster="1">
        <div>
          <h3>İlan vermek ücretsiz</h3>
          <p>İlanınızı yayınlamak için ödeme yapmazsınız.</p>
        </div>
        <a class="dugme dugme-mavi" href="ilan-ver.html" data-ilan-ver="sunu">İlanımı göndereyim ${IK.ok}</a>
      </div>
      <div class="sunu-kutu" data-goster="2">
        <span class="sunu-ikon">${IK.yayin}</span>
        <h3>Üç mecrada aynı gün</h3>
        <p>İlanınız sitemizde, Instagram'da ve Facebook sayfamızda yayınlanır.</p>
      </div>
      <div class="sunu-kutu" data-goster="3">
        <span class="sunu-ikon">${IK.kalkan}</span>
        <h3>Temiz bir ilan ortamı</h3>
        <p>Adaydan para isteyen ilanları yayınlamıyoruz. İlanınız bu kurala uyan bir panoda yer alır.</p>
      </div>
    </div>
  </div>
</section>

<section class="bolum">
  <div class="kap">
    <div class="bolum-bas" data-goster>
      <h2>Panoda şimdi</h2>
      <p>İş arayanlar için son yayınlanan ilanlar.</p>
    </div>
    <div class="ilan-liste">
${secilen.map(i=>satir(i)).join('\n')}
    </div>
    <p style="margin-top:1.6rem"><a class="dugme dugme-hat" href="guncel-ilanlar.html">Tüm güncel ilanlar ${IK.ok}</a></p>
  </div>
</section>
${cagri()}`;
  yaz('index.html', sayfa({baslik:"Ankara İş İlanları | Ücretsiz iş ilanı verin, Ankara'da eleman bulun",
    aciklama:"Ankara'da eleman arıyorsanız ilanınızı ücretsiz yayınlayalım. İlanınız sitemizde, Instagram'da ve Facebook sayfamızda yer alır. Üyelik gerekmez.",
    yol:'',ld:[ORG,{'@context':'https://schema.org','@type':'WebSite',name:'Ankara İş İlanları',url:SITE,inLanguage:'tr-TR'}],aktif:'ana',govde}));
}

/* ——— 2. GÜNCEL İLANLAR ——— */
{
  const ld=[{'@context':'https://schema.org','@type':'ItemList',name:'Ankara güncel iş ilanları',numberOfItems:ilanlar.length,
    itemListElement:ilanlar.map((i,n)=>({'@type':'ListItem',position:n+1,url:`${SITE}/${ilanYol(i)}`,name:i.baslik}))},
    yolIzi([{ad:'Ana Sayfa',yol:''},{ad:'Güncel İlanlar',yol:'guncel-ilanlar.html'}])];
  const govde=`${sayfaBas({yol:yolBas('', 'Güncel İlanlar'),baslik:"Ankara'da güncel iş ilanları",
    lead:`Bu sayfadaki ilanlar işverenlerden bize ulaşan taleplerden derleniyor. Aday hiçbir aşamada para ödemez. Son güncelleme: ${trTarih(bugun)}.`})}
<section class="bolum">
  <div class="kap">
    <div class="ilan-liste">
${ilanlar.map(i=>satir(i)).join('\n')}
    </div>
  </div>
</section>

<section class="bolum bolum-yuzey">
  <div class="kap ikili">
    <div>
      <h2>İlana başvurmadan önce üç soru</h2>
      <p><strong>Para isteniyor mu?</strong> İşe girmek için ödeme yapılmaz. İstenirse başvurmayın ve bize bildirin.</p>
      <p><strong>Yer ve saat belli mi?</strong> Çalışma yeri, vardiya ve ücret işe başlamadan netleşmeli.</p>
      <p><strong>Sigorta var mı?</strong> Yarı zamanlı çalışmada da işveren sigorta bildirimi yapmakla yükümlüdür.</p>
    </div>
    <div class="panel">
      <h3>Sahte ilan gördüyseniz</h3>
      <p>Panoda sizden para isteyen bir ilan görürseniz bize yazın. İlanı siteden, Instagram'dan ve Facebook sayfasından aynı gün kaldırıyoruz.</p>
      <a class="dugme dugme-mavi" href="mailto:${EPOSTA}?subject=${encodeURIComponent('Sahte ilan bildirimi')}" data-yer="sahte_ilan">İlanı bildirin</a>
    </div>
  </div>
</section>
${cagri()}`;
  yaz('guncel-ilanlar.html', sayfa({baslik:`Güncel İş İlanları | Ankara İş İlanları`,
    aciklama:`Ankara'daki güncel iş ilanları: mağaza, depo, üretim, temizlik, kurye ve servis. İlanlar ücret talebi kontrolünden geçirilerek yayınlanır.`,
    yol:'guncel-ilanlar.html',ld,aktif:'guncel',govde}));
}

/* ——— 3. GENEL İLANLAR ——— */
{
  const sektorler=[...new Set(ilanlar.map(i=>i.kategori))];
  const ilceler=[...new Set(ilanlar.map(i=>i.ilce))].sort((a,b)=>a.localeCompare(b,'tr'));
  const govde=`${sayfaBas({yol:yolBas('', 'Genel İlanlar'),baslik:'Sektöre ve ilçeye göre Ankara iş ilanları',
    lead:'Yayındaki tüm ilanları sektöre ve ilçeye göre süzün.'})}
<section class="bolum">
  <div class="kap">
    <div class="suzgec" role="group" aria-label="İlan süzgeci">
      <button class="chip" type="button" data-sektor-sec="hepsi" aria-pressed="true">Tüm sektörler</button>
${sektorler.map(s=>`      <button class="chip" type="button" data-sektor-sec="${kac(s)}" aria-pressed="false">${kac(SEKTOR[s]||s)}</button>`).join('\n')}
      <select class="secim" data-ilce-sec aria-label="İlçe seç">
        <option value="hepsi">Tüm ilçeler</option>
${ilceler.map(s=>`        <option value="${kac(s)}">${kac(s)}</option>`).join('\n')}
      </select>
    </div>
    <div class="ilan-liste" data-suzulecek>
${ilanlar.map(i=>satir(i)).join('\n')}
    </div>
    <p class="liste-bos" data-bos hidden>Bu süzgece uyan ilan yok. Süzgeci değiştirin ya da ilan veren işverenlerden biri olun.</p>
  </div>
</section>
${cagri()}`;
  yaz('genel-ilanlar.html', sayfa({baslik:'Genel İş İlanları | Ankara İş İlanları',
    aciklama:"Ankara iş ilanlarını sektöre ve ilçeye göre süzün: satış, üretim, temizlik, kurye, servis ve ön büro ilanları tek sayfada.",
    yol:'genel-ilanlar.html',ld:[yolIzi([{ad:'Ana Sayfa',yol:''},{ad:'Genel İlanlar',yol:'genel-ilanlar.html'}])],aktif:'genel',govde}));
}

/* ——— 4. HAKKIMIZDA ——— */
{
  const govde=`${sayfaBas({yol:yolBas('', 'Hakkımızda'),baslik:"Ankara'da iş arayanla eleman arayan burada buluşuyor",
    lead:"Ankara İş İlanları, Ankara'daki işverenlerle iş arayanları tek çatıda buluşturan bir ilan platformudur. Üç ayrı kanaldaki topluluğumuz, ilanların ulaşabileceği geniş bir kitle oluşturur."})}
<section class="bolum">
  <div class="kap">
    <div class="bolum-bas" data-goster>
      <h2>Topluluğumuz</h2>
      <p>İlanlar tek bir yerde kalmıyor. Platformun arkasında etkileşimde olan, birbirini tanıyan bir topluluk var.</p>
    </div>
    <div class="kanal">
      <div class="kanal-kutu" data-goster="1"><div class="sayi">41 bin+</div><h3>Facebook grubu</h3><p>Ankara'daki iş arayanların ve işverenlerin bir arada bulunduğu, 41 binden fazla üyeli grubumuz.</p></div>
      <div class="kanal-kutu" data-goster="2"><div class="sayi">2,8 bin+</div><h3>Facebook sayfası</h3><p>İlanlarımızı yayınladığımız ve işverenlerle yazıştığımız resmî sayfamız.</p></div>
      <div class="kanal-kutu" data-goster="3"><div class="sayi">2 bin+</div><h3>LinkedIn</h3><p>İş dünyasıyla bağlantıda kaldığımız LinkedIn sayfamız.</p></div>
    </div>
  </div>
</section>

<section class="bolum bolum-yuzey">
  <div class="kap ikili ikili-dar">
    <div>
      <h2>Neden güvenilir bir platformuz?</h2>
      <p>Ankara'da iş arayan en çok iki soruyu soruyor: “Bu ilan gerçek mi?” ve “Para isterlerse ne olacak?” Yayın ilkelerimiz bu iki sorunun cevabı üzerine kurulu.</p>
      <ul class="kontrol">
        <li><span class="im im-evet" aria-hidden="true">✓</span><span><strong>Aday para ödemez.</strong> Kapora, kargo, üyelik ya da eğitim bedeli isteyen ilanları yayınlamıyoruz.</span></li>
        <li><span class="im im-evet" aria-hidden="true">✓</span><span><strong>İlanlar yayından önce okunur.</strong> Cinsiyet ve yaş şartı gibi ayrımcı ifadeler çıkarılır.</span></li>
        <li><span class="im im-evet" aria-hidden="true">✓</span><span><strong>Telefon numaraları sitede yer almaz.</strong> Başvurular bizim üzerimizden yürür.</span></li>
        <li><span class="im im-evet" aria-hidden="true">✓</span><span><strong>Sahte ilan bildirimi hızlı sonuçlanır.</strong> Bildirilen ilanı siteden, Instagram'dan ve Facebook sayfasından aynı gün kaldırıyoruz.</span></li>
      </ul>
    </div>
    <div class="panel">
      <h3>İşveren misiniz?</h3>
      <p>İlanınızı ücretsiz yayınlayalım. Formu doldurmanız birkaç dakika sürer.</p>
      <a class="dugme dugme-sari" href="ilan-ver.html" data-ilan-ver="hakkimizda">Ücretsiz ilan verin ${IK.ok}</a>
      <hr style="border:0;border-top:1px solid var(--hat);margin:1.5rem 0">
      <h3>İş mi arıyorsunuz?</h3>
      <p>Yayındaki ilanlara göz atın. Başvurmak için üyelik gerekmez.</p>
      <a class="dugme dugme-hat" href="guncel-ilanlar.html">Güncel ilanlar</a>
    </div>
  </div>
</section>

<section class="bolum">
  <div class="kap yazi">
    <h2>Neyi yapmıyoruz?</h2>
    <p>İş bulma vaadinde bulunmuyoruz. İşverenlerden bize ulaşan ilanları yayınlıyor, başvuruların ulaşmasına aracılık ediyoruz. İşe alım kararı her zaman işverene aittir.</p>
  </div>
</section>
${cagri()}`;
  yaz('hakkimizda.html', sayfa({baslik:'Hakkımızda | Ankara İş İlanları',
    aciklama:"Ankara İş İlanları: 41 binden fazla üyeli Facebook grubu, Facebook sayfası ve LinkedIn topluluğuyla Ankara'da işverenle iş arayanı buluşturan ilan platformu.",
    yol:'hakkimizda.html',ld:[ORG,yolIzi([{ad:'Ana Sayfa',yol:''},{ad:'Hakkımızda',yol:'hakkimizda.html'}])],aktif:'hakkimizda',govde}));
}

/* ——— 5. İLETİŞİM ——— */
{
  const govde=`${sayfaBas({yol:yolBas('', 'İletişim'),baslik:'Bize ulaşın',
    lead:'İlan vermek, sahte ilan bildirmek ya da bir soru sormak için bize yazın.'})}
<section class="bolum">
  <div class="kap ikili ikili-dar">
    <div>
      <ul class="iletisim-liste">
        <li><a href="mailto:${EPOSTA}" data-yer="iletisim"><span class="ik">${IK.posta}</span><span><b>E-posta</b><small>${EPOSTA}</small></span></a></li>
        <li><a href="${FB_GRUP}" target="_blank" rel="noopener" data-sosyal="facebook_grup"><span class="ik">${IK.grup}</span><span><b>Facebook grubu</b><small>41 binden fazla üyeli topluluğumuz</small></span></a></li>
        <li><a href="${FB_SAYFA}" target="_blank" rel="noopener" data-sosyal="facebook_sayfa"><span class="ik">${IK.fb.replace('<svg','<svg fill="#3B46F2"')}</span><span><b>Facebook sayfası</b><small>@ankaraisilanlaricomtr</small></span></a></li>
        <li><a href="${INSTAGRAM}" target="_blank" rel="noopener" data-sosyal="instagram"><span class="ik">${IK.ig.replace('<svg','<svg fill="#3B46F2"')}</span><span><b>Instagram</b><small>@ankaraisilanlaricomtr</small></span></a></li>
        <li><a href="${LINKEDIN}" target="_blank" rel="noopener" data-sosyal="linkedin"><span class="ik">${IK.in.replace('<svg','<svg fill="#3B46F2"')}</span><span><b>LinkedIn</b><small>Ankara İş İlanları</small></span></a></li>
      </ul>
    </div>
    <div class="panel panel-yuzey">
      <h2 style="font-size:1.4rem">İlan vermek mi istiyorsunuz?</h2>
      <p>E-posta yazmanıza gerek yok. Formu doldurun, ilanınızı kontrol edip yayınlayalım.</p>
      <a class="dugme dugme-sari" href="ilan-ver.html" data-ilan-ver="iletisim">Ücretsiz ilan verin ${IK.ok}</a>
      <hr style="border:0;border-top:1px solid var(--hat);margin:1.5rem 0">
      <h2 style="font-size:1.4rem">Sahte ilan mı gördünüz?</h2>
      <p>İlan kodunu ya da bağlantısını yazarak bildirin. İlanı aynı gün kaldırıyoruz.</p>
      <a class="dugme dugme-mavi" href="mailto:${EPOSTA}?subject=${encodeURIComponent('Sahte ilan bildirimi')}" data-yer="sahte_ilan">İlanı bildirin</a>
    </div>
  </div>
</section>`;
  yaz('iletisim.html', sayfa({baslik:'İletişim | Ankara İş İlanları',
    aciklama:`Ankara İş İlanları ile iletişime geçin: ilan vermek, sahte ilan bildirmek ya da soru sormak için ${EPOSTA} adresine yazın.`,
    yol:'iletisim.html',ld:[ORG,yolIzi([{ad:'Ana Sayfa',yol:''},{ad:'İletişim',yol:'iletisim.html'}])],aktif:'iletisim',govde}));
}

/* ——— 6. İLAN VER (işveren formu) ——— */
{
  const govde=`${sayfaBas({yol:yolBas('', 'Ücretsiz İlan Ver'),baslik:'İlanınızı ücretsiz yayınlayalım',
    lead:"Formu doldurun, ilanınızı kontrol edip sitemizde, Instagram'da ve Facebook sayfamızda yayınlayalım."})}
<section class="bolum">
  <div class="kap ikili ikili-dar">
    <div class="panel">
      <form class="form" id="ilan-formu" novalidate>
        <div class="form-ikili">
          <div class="alan"><label for="firma">Firma veya yetkili adı</label><input id="firma" name="firma" type="text" autocomplete="organization"><p class="hata">Firma veya yetkili adını yazın.</p></div>
          <div class="alan"><label for="telefon">Telefon <span class="not">(ilanda yayınlanmaz)</span></label><input id="telefon" name="telefon" type="tel" autocomplete="tel" inputmode="tel"><p class="hata">Size ulaşabileceğimiz bir telefon yazın.</p></div>
        </div>
        <div class="alan"><label for="eposta">E-posta</label><input id="eposta" name="eposta" type="email" autocomplete="email"><p class="hata">Geçerli bir e-posta adresi yazın.</p></div>
        <div class="form-ikili">
          <div class="alan"><label for="pozisyon">Aradığınız pozisyon</label><input id="pozisyon" name="pozisyon" type="text" placeholder="Örnek: Kasiyer"><p class="hata">Aradığınız pozisyonu yazın.</p></div>
          <div class="alan"><label for="ilce">Çalışma yeri (ilçe)</label>
            <select id="ilce" name="ilce"><option value="">İlçeyi seçin</option>${ILCELER.map(s=>`<option>${s}</option>`).join('')}</select><p class="hata">İlçeyi seçin.</p></div>
        </div>
        <fieldset class="alan secenekler"><legend>Çalışma şekli</legend>
          <label class="secenek"><input type="radio" name="calisma" value="Tam zamanlı" checked><span>Tam zamanlı</span></label>
          <label class="secenek"><input type="radio" name="calisma" value="Yarı zamanlı"><span>Yarı zamanlı</span></label>
          <label class="secenek"><input type="radio" name="calisma" value="Vardiyalı"><span>Vardiyalı</span></label>
        </fieldset>
        <fieldset class="alan secenekler"><legend>Sigortalı çalışma</legend>
          <label class="secenek"><input type="radio" name="sigorta" value="Var" checked><span>Var</span></label>
          <label class="secenek"><input type="radio" name="sigorta" value="Yok"><span>Yok</span></label>
        </fieldset>
        <div class="alan"><label for="ucret">Ücret <span class="not">(isteğe bağlı)</span></label><input id="ucret" name="ucret" type="text" placeholder="Örnek: 33.000 TL"></div>
        <div class="alan"><label for="aciklama">İş tanımı ve şartlar <span class="not">(isteğe bağlı)</span></label><textarea id="aciklama" name="aciklama" placeholder="Çalışma saatleri, yemek, servis gibi bilgileri yazabilirsiniz."></textarea></div>
        <div class="alan"><label class="onay"><input type="checkbox" name="kvkk"><span><a href="gizlilik.html" target="_blank">Gizlilik ve KVKK bildirimini</a> okudum.</span></label><p class="hata">Devam etmek için bildirimi okuduğunuzu onaylayın.</p></div>
        <button class="dugme dugme-mavi" type="submit">İlanı e-posta ile gönder ${IK.ok}</button>
        <div class="form-sonuc" id="form-sonuc" tabindex="-1" role="status"><strong>E-posta uygulamanız açıldı.</strong>Hazırlanan iletiyi göndermeniz yeterli. Uygulama açılmazsa aynı bilgileri ${EPOSTA} adresine yazabilirsiniz.</div>
      </form>
    </div>
    <aside class="panel panel-yuzey">
      <h2 style="font-size:1.35rem">Yayından önce neleri kontrol ediyoruz?</h2>
      <ul class="kontrol">
        <li><span class="im im-evet" aria-hidden="true">✓</span><span>İlanda adaydan ücret talebi olmaması</span></li>
        <li><span class="im im-evet" aria-hidden="true">✓</span><span>Cinsiyet ve yaş şartı gibi ayrımcı ifadelerin çıkarılması</span></li>
        <li><span class="im im-evet" aria-hidden="true">✓</span><span>İş yerinin, saatin ve şartların açık yazılması</span></li>
      </ul>
      <p style="margin-top:1.2rem;font-size:.92rem;color:var(--ink-2)">Telefon numaranız ilanda yayınlanmaz. Başvurular size bizim üzerimizden iletilir.</p>
    </aside>
  </div>
</section>`;
  yaz('ilan-ver.html', sayfa({baslik:'Ücretsiz İlan Ver | Ankara İş İlanları',
    aciklama:"Ankara'da eleman arıyorsanız ilanınızı ücretsiz verin. Formu doldurun, ilanınızı sitemizde, Instagram'da ve Facebook sayfamızda yayınlayalım.",
    yol:'ilan-ver.html',ld:[yolIzi([{ad:'Ana Sayfa',yol:''},{ad:'Ücretsiz İlan Ver',yol:'ilan-ver.html'}])],govde}));
}

/* ——— 7. GİZLİLİK VE KVKK ——— */
{
  const govde=`${sayfaBas({yol:yolBas('', 'Gizlilik ve KVKK'),baslik:'Gizlilik, KVKK ve çerez bildirimi',lead:'Hangi bilgileri neden işlediğimizi ve tercihlerinizi nasıl değiştirebileceğinizi burada açıkça yazıyoruz. Son güncelleme: 11 Kasım 2026.'})}
<section class="bolum">
  <div class="kap yazi">
    <h2>Veri sorumlusu</h2>
    <p>Bu sitenin veri sorumlusu Ankara İş İlanları'dır. Bize ${EPOSTA} adresinden ulaşabilirsiniz.</p>
    <h2>Hangi bilgileri işliyoruz?</h2>
    <p><strong>İlan formu:</strong> firma veya yetkili adı, telefon, e-posta ve ilanla ilgili bilgiler.</p>
    <p><strong>E-postalar:</strong> bize yazdığınız iletiler ve içindeki bilgiler.</p>
    <p><strong>Çerezler:</strong> sayfa görüntüleme, tıklama, cihaz ve tarayıcı bilgisi gibi kullanım verileri.</p>
    <h2>Neden işliyoruz?</h2>
    <p>İlanınızı değerlendirmek, yayınlamak ve sizinle iletişim kurmak için. Çerez onayı verirseniz ayrıca sitemizin nasıl kullanıldığını ölçmek ve ilan reklamlarımızın etkisini değerlendirmek için.</p>
    <h2>Çerezler</h2>
    <p><strong>Gerekli çerez bilgisi:</strong> çerez tercihinizi tarayıcınızda saklarız. Bunun için onayınız aranmaz.</p>
    <p><strong>Analiz ve reklam ölçümü:</strong> Google Analytics ve Meta (Facebook, Instagram) ölçüm araçlarını yalnız “Tümünü kabul et” seçeneğini seçerseniz çalıştırırız. “Yalnız gerekli olanlar” seçeneğinde bu araçlar çerez bırakmaz.</p>
    <p>Tercihinizi istediğiniz zaman değiştirebilirsiniz: <a href="#" data-cerez-ac>çerez tercihlerini yeniden aç</a>.</p>
    <h2>Bilgiler yurt dışına aktarılır mı?</h2>
    <p>Google ve Meta hizmetleri yurt dışındaki sunucularda çalışır. Bu araçlar yalnız çerez onayınız varsa çalışır; onay vermezseniz verileriniz bu şirketlere ulaşmaz.</p>
    <h2>Ne kadar saklıyoruz?</h2>
    <p>İlan bilgilerini ilan yayında olduğu sürece ve amacın gerektirdiği süre kadar saklarız. Sonrasında siler ya da anonim hâle getiririz.</p>
    <h2>Haklarınız</h2>
    <p>6698 sayılı Kişisel Verilerin Korunması Kanunu'nun 11. maddesi kapsamındaki haklarınızı kullanmak için ${EPOSTA} adresine yazabilirsiniz.</p>
  </div>
</section>`;
  yaz('gizlilik.html', sayfa({baslik:'Gizlilik, KVKK ve Çerez Bildirimi | Ankara İş İlanları',
    aciklama:'Ankara İş İlanları gizlilik, KVKK ve çerez bildirimi: hangi bilgileri neden işlediğimiz ve çerez tercihlerinizi nasıl değiştirebileceğiniz.',
    yol:'gizlilik.html',ld:[yolIzi([{ad:'Ana Sayfa',yol:''},{ad:'Gizlilik ve KVKK',yol:'gizlilik.html'}])],govde}));
}

/* ——— 8. KATEGORİ SAYFALARI (rehberler; altbilgiden erişilir) ——— */
for (const [anahtar,kat] of Object.entries(KATEGORI)) {
  const kendi = yazi.filter(y=>y.kategori===anahtar);
  const sss = kendi.flatMap(y=>y.sss||[]).slice(0,5);
  const ld=[{'@context':'https://schema.org','@type':'CollectionPage',name:kat.ad,url:`${SITE}/${kat.dosya}`,inLanguage:'tr-TR',
      about:{'@type':'Thing',name:kat.anahtar},
      hasPart:kendi.map(y=>({'@type':'Article',headline:y.baslik,url:`${SITE}/${yaziYol(y)}`,datePublished:y.tarih}))},
    {'@context':'https://schema.org','@type':'FAQPage',inLanguage:'tr-TR',
      mainEntity:sss.map(q=>({'@type':'Question',name:q.s,acceptedAnswer:{'@type':'Answer',text:duz(q.c)}}))},
    yolIzi([{ad:'Ana Sayfa',yol:''},{ad:kat.ad,yol:kat.dosya}])];
  const govde=`${sayfaBas({yol:yolBas('', kat.ad),baslik:kat.girisBaslik,lead:kat.giris})}
<section class="bolum">
  <div class="kap">
    <div class="bolum-bas"><h2>Rehberler</h2><p>Bu bölüme düzenli olarak yeni yazı ekliyoruz.</p></div>
    <div class="izgara-3">
${kendi.map(y=>yaziKart(y)).join('\n')}
    </div>
  </div>
</section>
${sssBlok(sss)}
${cagri()}`;
  yaz(kat.dosya, sayfa({baslik:kat.baslik,aciklama:kat.ozet,yol:kat.dosya,ld,govde}));
}

/* ——— 9. MAKALELER ——— */
for (const y of yazi) {
  const kat = KATEGORI[y.kategori];
  const digerleri = yazi.filter(x=>x.slug!==y.slug && x.kategori===y.kategori).slice(0,2);
  const ld=[{'@context':'https://schema.org','@type':'Article',headline:y.baslik,description:y.ozet,
      datePublished:y.tarih,dateModified:y.tarih,inLanguage:'tr-TR',
      author:{'@type':'Organization',name:'Ankara İş İlanları'},publisher:ORG,
      mainEntityOfPage:{'@type':'WebPage','@id':`${SITE}/${yaziYol(y)}`}},
    {'@context':'https://schema.org','@type':'FAQPage',inLanguage:'tr-TR',
      mainEntity:(y.sss||[]).map(q=>({'@type':'Question',name:q.s,acceptedAnswer:{'@type':'Answer',text:duz(q.c)}}))},
    yolIzi([{ad:'Ana Sayfa',yol:''},{ad:kat.ad,yol:kat.dosya},{ad:y.baslik,yol:yaziYol(y)}])];
  const govde=`${sayfaBas({yol:yolBas('../', `<a href="../${kat.dosya}">${kac(kat.ad)}</a>`),baslik:kac(y.baslik),lead:`${kac(y.ozet)}`})}
<section class="bolum">
  <div class="kap yazi">
    <p style="font-size:.88rem;color:var(--ink-2)">${trTarih(y.tarih)} · ${y.okuma} dakikalık okuma</p>
${y.bolumler.map(b=>`    <h2>${kac(b.h)}</h2>
${b.p.map(p=>`    <p>${p}</p>`).join('\n')}`).join('\n')}
    <div class="panel panel-yuzey" style="margin-top:2rem">
      <h3>Kısaca</h3>
      <ul class="kontrol">
        <li><span class="im im-evet" aria-hidden="true">✓</span><span>Gerçek işveren, işe alacağı kişiden para istemez.</span></li>
        <li><span class="im im-evet" aria-hidden="true">✓</span><span>Çalışma yeri, saati ve ücreti işe başlamadan yazılı hâle gelmeli.</span></li>
        <li><span class="im im-hayir" aria-hidden="true">✕</span><span>Kimlik ve IBAN bilgisi görüşme öncesi paylaşılmaz.</span></li>
      </ul>
      <p style="margin:1.1rem 0 0"><a class="dugme dugme-mavi" href="../guncel-ilanlar.html">Güncel ilanlara bakın</a></p>
    </div>
  </div>
</section>
${sssBlok(y.sss)}
${digerleri.length?`<section class="bolum bolum-yuzey">
  <div class="kap">
    <div class="bolum-bas"><h2>Bu bölümdeki diğer yazılar</h2></div>
    <div class="izgara-3">
${digerleri.map(d=>yaziKart(d,'../')).join('\n')}
    </div>
  </div>
</section>`:''}
${cagri('../')}`;
  yaz(yaziYol(y), sayfa({baslik:`${y.baslik} | Ankara İş İlanları`,aciklama:y.ozet,yol:yaziYol(y),ld,k:'../',govde}));
}

/* ——— 10. İLAN SAYFALARI ——— */
for (const i of ilanlar) {
  const benzer = ilanlar.filter(x=>x.kod!==i.kod && (x.ilce===i.ilce||x.kategori===i.kategori)).slice(0,3);
  const ld=[{'@context':'https://schema.org','@type':'JobPosting',title:i.baslik,description:i.aciklama,
      datePosted:i.tarih,employmentType:i.calisma==='Tam zamanlı'?'FULL_TIME':'PART_TIME',
      hiringOrganization:{'@type':'Organization',name:'Ankara İş İlanları',sameAs:SITE},
      jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressLocality:i.ilce,addressRegion:'Ankara',addressCountry:'TR',streetAddress:i.semt}},
      directApply:false,inLanguage:'tr-TR',
      identifier:{'@type':'PropertyValue',name:'Ankara İş İlanları',value:i.kod}},
    yolIzi([{ad:'Ana Sayfa',yol:''},{ad:'Güncel İlanlar',yol:'guncel-ilanlar.html'},{ad:i.baslik,yol:ilanYol(i)}])];
  const govde=`${sayfaBas({yol:yolBas('../', `<a href="../guncel-ilanlar.html">Güncel İlanlar</a>`),baslik:kac(i.baslik),lead:kac(i.aciklama),
    eylem:`<a class="dugme dugme-sari" href="mailto:${EPOSTA}?subject=${encodeURIComponent(i.kod+' – '+i.baslik)}" data-basvur="${kac(i.kod)}">Bu ilana başvurun ${IK.ok}</a><a class="dugme dugme-hat" href="../guncel-ilanlar.html">Diğer ilanlar</a>`})}
<section class="bolum">
  <div class="kap ikili">
    <div class="panel">
      <h2 style="font-size:1.35rem">İlan bilgileri</h2>
      <ul class="kontrol" style="gap:.7rem;grid-template-columns:1fr">
        <li style="grid-template-columns:1fr"><span><strong>Konum:</strong> ${kac(i.semt)}, ${kac(i.ilce)} / Ankara</span></li>
        <li style="grid-template-columns:1fr"><span><strong>Çalışma şekli:</strong> ${kac(i.calisma)}</span></li>
${i.vardiya?`        <li style="grid-template-columns:1fr"><span><strong>Vardiya:</strong> ${kac(i.vardiya)}</span></li>`:''}
        <li style="grid-template-columns:1fr"><span><strong>Sigorta:</strong> ${i.sigorta?'İşveren tarafından yapılır':'İlanda belirtilmemiş'}</span></li>
${(i.tecrube===true||i.tecrube===false)?`        <li style="grid-template-columns:1fr"><span><strong>Tecrübe:</strong> ${i.tecrube?'Tecrübeli aday aranıyor':'Şart değil'}</span></li>`:''}
${i.ucret?`        <li style="grid-template-columns:1fr"><span><strong>Ücret:</strong> ${kac(i.ucret)}</span></li>`:''}
        <li style="grid-template-columns:1fr"><span><strong>İlan kodu:</strong> ${kac(i.kod)} · ${trTarih(i.tarih)}</span></li>
      </ul>
    </div>
    <div class="panel panel-yuzey">
      <h2 style="font-size:1.35rem">Başvuru güvenliği</h2>
      <p>Bu ilan ücret talebi kontrolünden geçti. İşe girmek için sizden kapora, kargo, üyelik ya da eğitim ücreti istenmez.</p>
      <ul class="kontrol">
        <li><span class="im im-evet" aria-hidden="true">✓</span><span>Başvurunuz bizim üzerimizden işverene iletilir</span></li>
        <li><span class="im im-hayir" aria-hidden="true">✕</span><span>Para isteyen olursa başvurmayın, bize bildirin</span></li>
      </ul>
    </div>
  </div>
</section>
${benzer.length?`<section class="bolum bolum-yuzey">
  <div class="kap">
    <div class="bolum-bas"><h2>Benzer ilanlar</h2></div>
    <div class="ilan-liste">
${benzer.map(b=>satir(b,'../')).join('\n')}
    </div>
  </div>
</section>`:''}
${cagri('../')}`;
  yaz(ilanYol(i), sayfa({baslik:`${i.baslik}: ${i.ilce}, Ankara`,
    aciklama:`${i.ilce} ${i.semt} bölgesinde ${i.calisma.toLowerCase()} ${i.baslik.toLowerCase()} ilanı. ${i.sigorta?'Sigortalı çalışma. ':''}Aday para ödemez.`,
    yol:ilanYol(i),ld,k:'../',govde}));
}

/* ——— 10b. 404 ——— */
yaz('404.html', sayfa({baslik:'Sayfa bulunamadı | Ankara İş İlanları',aciklama:'Aradığınız sayfa bulunamadı. Ana sayfaya dönebilir ya da güncel ilanlara bakabilirsiniz.',yol:'404.html',k:'/',robots:'noindex,follow',
  govde:`${sayfaBas({yol:'',baslik:'Bu sayfayı bulamadık',lead:'Adres değişmiş ya da yanlış yazılmış olabilir. Aşağıdaki sayfalardan devam edebilirsiniz.',eylem:'<a class="dugme dugme-sari" href="/index.html">Ana sayfa</a><a class="dugme dugme-hat" href="/guncel-ilanlar.html">Güncel ilanlar</a>'})}`}));

/* ——— 11. SITEMAP ——— */
const sayfalar=[
  ['',1.0,'daily'],['guncel-ilanlar.html',0.95,'daily'],['genel-ilanlar.html',0.9,'daily'],['ilan-ver.html',0.9,'monthly'],
  ['hakkimizda.html',0.6,'monthly'],['iletisim.html',0.6,'monthly'],['ek-is-ilanlari.html',0.8,'weekly'],['evde-paketleme-isi.html',0.8,'weekly'],['gizlilik.html',0.3,'yearly'],
  ...yazi.map(y=>[yaziYol(y),0.7,'monthly']),
  ...ilanlar.map(i=>[ilanYol(i),0.7,'weekly'])];
yaz('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sayfalar.map(([s,p,f])=>`  <url><loc>${SITE}/${s}</loc><lastmod>${bugun}</lastmod><changefreq>${f}</changefreq><priority>${p}</priority></url>`).join('\n')}
</urlset>`);

console.log(`✓ üretildi: ana sayfa · güncel · genel · hakkımızda · iletişim · ilan ver · gizlilik · 2 rehber kategorisi · ${yazi.length} yazı · ${ilanlar.length} ilan sayfası · sitemap (${sayfalar.length} adres)`);
