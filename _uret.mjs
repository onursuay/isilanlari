#!/usr/bin/env node
/* Ankara İş İlanı — site üreteci (tek kaynak)
   veri/ilanlar.json  → Güncel İlanlar, Genel İlanlar, ilan sayfaları (JobPosting)
   veri/yazilar.json  → Ek İş İlanları ve Evde Paketleme İşi rehberleri (altbilgiden erişilir)
   Çalıştır: node _uret.mjs   |  Tasarım: stil.css + betik.js  |  Tasarım yönü: işveren önce (11.11.2026) */

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const SITE = process.env.SITE_URL || 'https://ankaraisilani.com';
const ADSENSE = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4455796317251834"
     crossorigin="anonymous"></script>`;
const GTM = 'GTM-KS8JNCLW';                 /* ankaraisilani.com kapsayıcısı (yalnız bu site) */
const EPOSTA = 'info@ankaraisilani.com';
const FB_SAYFA = 'https://www.facebook.com/ankaraisilanicom/';
const FB_GRUP = 'https://www.facebook.com/groups/ankaraisilanlari';
const INSTAGRAM = 'https://www.instagram.com/ankaraisilanicom/';
const LINKEDIN = 'https://www.linkedin.com/company/85396970/';

const oku = p => fs.readFileSync(path.join(KOK,p),'utf8');
/* CSS ve JS adreslerine içerik özeti eklenir: dosya değişince adres değişir, tarayıcı eski sürümü kullanamaz */
const surum = d => crypto.createHash('md5').update(fs.readFileSync(path.join(KOK,d))).digest('hex').slice(0,8);
/* Adres kuralı (Owner 11.11.2026): hiçbir adreste .html görünmez; ana sayfa "/" olur.
   Üreteç dosyaları .html olarak yazar, Vercel cleanUrls ile uzantısız sunar. Bağlantılar burada tek noktadan düzeltilir. */
const temizAdres = s => s
  .replace(/(href|src)="(?:\.\.\/)*(?!https?:|mailto:|tel:|#|\/)([^"]*)"/g,(m,a,r)=>`${a}="/${r}"`)
  .replace(/href="(\/[^"#?]*?)\.html((?:[#?][^"]*)?)"/g,(m,r,q)=>`href="${r==='/index'?'/':r}${q}"`)
  .replace(/(https:\/\/ankaraisilani\.com\/[^"'\s<\\]*?)\.html/g,'$1')
  .replace(/https:\/\/ankaraisilani\.com\/index(?=["'\s<\\])/g,'https://ankaraisilani.com/');
/* Başlıklarda (h1-h3) her kelimenin baş harfi büyük (Owner 11.11.2026, tüm sayfalar); varlık adı ve kısaltmalar olduğu gibi kalır */
const bas1 = w => (w.startsWith('&') || /^\d+['’]/.test(w)) ? w : w.replace(/^([^\p{L}]*)(\p{L})/u,(m,p,l)=>p+l.toLocaleUpperCase('tr-TR'));
const GOLGE = new Set(["Ankara'da Eleman Arıyorsanız İlanınızı Ücretsiz Yayınlayalım","İlanınız Üç Adımda Yayında","İşverenler İçin Ne Yapıyoruz"]);
const baslikBuyuk = html => html.replace(/<h([1-3])((?:\s[^>]*)?)>([\s\S]*?)<\/h\1>/g,(m,n,attr,ic)=>{
  const yeni = ic.replace(/(<[^>]+>)|([^<]+)/g,(x,tag,txt)=>tag?tag:txt.replace(/\S+/g,bas1));
  const duzMetin = yeni.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
  let a = attr;
  if (GOLGE.has(duzMetin)) a = /class="/.test(a) ? a.replace('class="','class="baslik-golge ') : a+' class="baslik-golge"';
  return `<h${n}${a}>${yeni}</h${n}>`;
});
const yaz = (p,s) => { if(p.endsWith('.html')) s = baslikBuyuk(temizAdres(s)); fs.mkdirSync(path.dirname(path.join(KOK,p)),{recursive:true}); fs.writeFileSync(path.join(KOK,p),s); };
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
  alev:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
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
const sayfa = ({baslik,aciklama,yol,ld=[],k='',aktif='',govde,og=null,robots='index,follow,max-image-preview:large,max-snippet:-1'}) => `<!doctype html>
<html lang="tr" class="js-yok">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="facebook-domain-verification" content="ccf1vws8myjes894n4wv6keb534k4x">
<title>${kac(baslik)}</title>
<meta name="description" content="${kac(kisalt(aciklama,155))}">
<link rel="canonical" href="${SITE}/${yol}">
<meta name="robots" content="${robots}">
<meta name="theme-color" content="#3B46F2">
<meta property="og:site_name" content="Ankara İş İlanı">
<meta property="og:type" content="${og?'article':'website'}">
<meta property="og:title" content="${kac(baslik)}">
<meta property="og:description" content="${kac(kisalt(aciklama,155))}">
<meta property="og:locale" content="tr_TR">
<meta property="og:url" content="${SITE}/${yol}">
${og?`<meta property="og:image" content="${SITE}/${og.jpg}">
<meta property="og:image:secure_url" content="${SITE}/${og.jpg}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${kac(og.alt)}">
<meta property="article:published_time" content="${og.yayin}">
<meta property="article:modified_time" content="${og.guncel}">
<meta property="article:section" content="${kac(og.bolum)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${kac(baslik)}">
<meta name="twitter:description" content="${kac(kisalt(aciklama,155))}">
<meta name="twitter:image" content="${SITE}/${og.jpg}">
<meta name="twitter:image:alt" content="${kac(og.alt)}">
<link rel="preload" as="image" href="/${og.webp}" imagesrcset="/${og.webp800} 800w, /${og.webp} 1200w" imagesizes="(min-width:1180px) 1116px, 100vw" fetchpriority="high">`:`<meta property="og:image" content="${SITE}/medya/og.png?v=${surum('medya/og.png')}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">`}
<meta name="geo.region" content="TR-06">
<meta name="geo.placename" content="Ankara">
<link rel="icon" href="/favicon.ico?v=${surum('favicon.ico')}" sizes="48x48">
<link rel="icon" href="/medya/favicon.png?v=${surum('medya/favicon.png')}" type="image/png" sizes="256x256">
<link rel="apple-touch-icon" href="/medya/apple-touch-icon.png?v=${surum('medya/apple-touch-icon.png')}">
<link rel="preload" href="/medya/yazi/poppins-700-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/medya/yazi/poppins-700-latin-ext.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/medya/yazi/poppins-600-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/medya/yazi/poppins-600-latin-ext.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/medya/yazi/montserrat-400-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/medya/yazi/montserrat-400-latin-ext.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${k}stil.css?v=${surum('stil.css')}">
<script>
/* Çerez onayı (Consent Mode v2): her şey reddedilmiş başlar, onayla güncellenir. GTM'den ÖNCE çalışmalıdır. */
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});
gtag('set','ads_data_redaction',true);
try{if(localStorage.getItem('aii_cerez')==='hepsi'){gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'})}}catch(e){}
</script>
${robots.startsWith('noindex')?'':ADSENSE+'\n'}<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM}');</script>
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
<script src="${k}betik.js?v=${surum('betik.js')}" defer></script>
</body>
</html>`;

const MENU = [['ana','index.html','Ana Sayfa'],['guncel','guncel-ilanlar.html','Güncel İlanlar'],['genel','genel-ilanlar.html','Genel İlanlar'],['hakkimizda','hakkimizda.html','Hakkımızda'],['iletisim','iletisim.html','İletişim']];
const ust = (aktif,k='') => `<header class="ust">
  <div class="kap ust-ic">
    <a class="marka" href="${k}index.html" aria-label="Ankara İş İlanı, ana sayfa"><img src="${k}medya/logo-128.png?v=${surum('medya/logo-128.png')}" width="56" height="56" alt=""></a>
    <nav class="menu" id="ana-menu" aria-label="Ana menü">
${MENU.map(([a,h,t],n)=>`      <a href="${k}${h}" style="--i:${n}"${aktif===a?' aria-current="page"':''}>${t}</a>`).join('\n')}
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
        <a href="${k}index.html" aria-label="Ankara İş İlanı, ana sayfa"><img src="${k}medya/logo-192.png?v=${surum('medya/logo-192.png')}" width="72" height="72" alt=""></a>
        <p>Ankara'da iş arayanla eleman arayanı buluşturan ilan platformu. İlanlar yayından önce okunur, adaydan ücret isteyen ilan yayınlanmaz.</p>
        <div class="alt-sosyal">
          <a href="${FB_SAYFA}" rel="me noopener" target="_blank" aria-label="Facebook sayfamız" data-sosyal="facebook_sayfa">${IK.fb}</a>
          <a href="${INSTAGRAM}" rel="me noopener" target="_blank" aria-label="Instagram hesabımız" data-sosyal="instagram">${IK.ig}</a>
          <a href="${LINKEDIN}" rel="me noopener" target="_blank" aria-label="LinkedIn sayfamız" data-sosyal="linkedin">${IK.in}</a>
        </div>
      </div>
      <div>
        <h3 class="alt-baslik">Platform</h3>
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
        <h3 class="alt-baslik">Rehberler</h3>
        <ul>
          <li><a href="${k}ek-is-ilanlari.html">Ek İş İlanları</a></li>
          <li><a href="${k}evde-paketleme-isi.html">Evde Paketleme İşi</a></li>
        </ul>
      </div>
      <div>
        <h3 class="alt-baslik">İletişim</h3>
        <ul>
          <li><a href="mailto:${EPOSTA}" data-yer="alt">${EPOSTA}</a></li>
          <li><a href="${FB_GRUP}" rel="noopener" target="_blank" data-sosyal="facebook_grup">Facebook grubumuz</a></li>
          <li><a href="${k}gizlilik.html">Gizlilik ve KVKK</a></li>
          <li><a href="${k}reklam-aydinlatmasi.html">Hedefli reklam aydınlatması</a></li>
          <li><a href="#" data-cerez-ac>Çerez tercihleri</a></li>
        </ul>
      </div>
    </div>
    <div class="alt-kunye">
      <span>© 2026 Ankara İş İlanı</span>
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
const ORG = {'@context':'https://schema.org','@type':'Organization',name:'Ankara İş İlanı',url:SITE,
  logo:`${SITE}/medya/logo.png?v=${surum('medya/logo.png')}`,email:EPOSTA,areaServed:{'@type':'City',name:'Ankara'},
  sameAs:[FB_SAYFA,INSTAGRAM,LINKEDIN,FB_GRUP],
  description:"Ankara'da iş arayanla eleman arayanı buluşturan ilan platformu. Adaydan ücret istenmez."};

const yolBas = (k,...parca) => `<nav class="yol-izi" aria-label="Sayfa yolu"><a href="${k}index.html">Ana Sayfa</a>${parca.map(p=>`<span>${p}</span>`).join('')}</nav>`;
const sayfaBas = ({yol,baslik,lead,eylem='',leadSinif='',gorsel=''}) => `<section class="sayfa-bas${gorsel?' sayfa-bas-gorselli':''}">
  <div class="kap">
    ${yol}
    <h1${duz(baslik).length<=58?` class="h1-tek" style="--k:${duz(baslik).length}"`:''}>${baslik}</h1>
    ${lead?`<p class="lead${leadSinif?' '+leadSinif:''}">${lead}</p>`:''}
    ${eylem?`<div class="hero-eylem">${eylem}</div>`:''}
    ${gorsel}
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

/* Makale öne çıkan görselleri: medya/makale/<slug>.webp (1200x630), <slug>-800.webp, <slug>.jpg (paylaşım) */
const yaziGorsel = y => { if(!y.gorsel) return null; const b=`medya/makale/${y.slug}`;
  if(!fs.existsSync(path.join(KOK,b+'.webp'))) return null;
  return {webp:`${b}.webp?v=${surum(b+'.webp')}`,webp800:`${b}-800.webp?v=${surum(b+'-800.webp')}`,jpg:`${b}.jpg?v=${surum(b+'.jpg')}`,alt:y.gorsel.alt,baslik:y.gorsel.baslik}; };
const oneCikan = g => `<figure class="one-cikan">
      <img src="/${g.webp}" srcset="/${g.webp800} 800w, /${g.webp} 1200w" sizes="(min-width:1180px) 1116px, 100vw" width="1200" height="630" alt="${kac(g.alt)}" title="${kac(g.baslik)}" fetchpriority="high" decoding="async">
    </figure>`;
const yaziKart = (y,k='') => { const g=yaziGorsel(y); return `      <a class="kart${g?' kart-gorselli':''}" href="${k}${yaziYol(y)}">${g?`
        <img class="kart-gorsel" src="/${g.webp800}" width="800" height="420" alt="" loading="lazy" decoding="async">`:''}
        <span class="kart-ust">${KATEGORI[y.kategori].ad} · ${y.okuma} dakika</span>
        <h3>${kac(y.baslik)}</h3>
        <p>${kac(y.ozet)}</p>
        <span class="kart-ok">Yazıyı okuyun</span>
      </a>`; };

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

/* ——— form bileşenleri ——— */
const PIN = `<svg class="acilir-ik" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>`;
const OK2 = `<svg viewBox="0 0 24 24" fill="none" stroke="#0A2A66" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
const acilir = ({id,ad,yer,secenekler,tumu,varyant='',oznitelik=''}) => `<div class="acilir ${varyant}" data-acilir>
  <input type="hidden" ${ad?`name="${ad}"`:''} ${oznitelik} value="${tumu?'hepsi':''}" id="${id}">
  <button class="acilir-dugme" type="button" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="${id}-etiket ${id}-deger">${PIN}<span class="acilir-deger" id="${id}-deger" data-yer="${kac(yer)}">${kac(tumu||yer)}</span><span class="acilir-ok">${OK2}</span></button>
  <div class="acilir-panel" hidden>
    <label class="acilir-ara"><span class="gizli">Ara</span><input type="search" placeholder="Ara" autocomplete="off"></label>
    <ul class="acilir-liste" role="listbox" aria-label="${kac(yer)}">
${tumu?`      <li><button type="button" role="option" data-deger="hepsi" aria-selected="true">${kac(tumu)}</button></li>\n`:''}${secenekler.map(s=>`      <li><button type="button" role="option" data-deger="${kac(s)}" aria-selected="false">${kac(s)}</button></li>`).join('\n')}
    </ul>
  </div>
</div>`;
const segment = ({ad,baslik,secenekler,renk}) => `<fieldset class="alan segment-grup"><legend>${baslik}</legend>
  <div class="segment segment-${renk}" style="--n:${secenekler.length}">
${secenekler.map((s,n)=>`    <label><input type="radio" name="${ad}" value="${kac(s)}"${n===0?' checked':''}><span>${kac(s)}</span></label>`).join('\n')}
  </div></fieldset>`;

/* ——— 1. ANA SAYFA ——— */
{
  const secilen = ilanlar.slice(0,3);
  const yeniVar = ilanlar.some(i => (Date.now() - new Date(i.tarih+'T00:00:00+03:00').getTime())/86400000 <= 7); /* yalnız son 7 günde ilan varsa 'Yeni' gösterilir */
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
      <div class="adim" data-goster="1"><div class="adim-no">1</div><h3>Bize İletin</h3><p>Pozisyonu, çalışma yerini ve şartları kısa bir formla yazın.</p></div>
      <div class="adim" data-goster="2"><div class="adim-no">2</div><h3>Yayınlayalım</h3><p>Ücret talebi ve ayrımcı ifadeleri ayıklayıp ilanı yayınlarız.</p></div>
      <div class="adim" data-goster="3"><div class="adim-no">3</div><h3>Uygun Adayı Bulun</h3><p>Adaylar ilan üzerinden başvurur, başvuruları size biz iletiriz.</p></div>
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
          <p>İlanınızı yayınlamak için ödeme yapmazsınız. Dahil olanlar:</p>
        </div>
        <ul class="sunu-liste">
          <li><i>${IK.tik}</i>Sitemizde ilanınıza özel sayfa</li>
          <li><i>${IK.tik}</i>Instagram'da görsel ilan kartı</li>
          <li><i>${IK.tik}</i>Facebook sayfamızda gönderi</li>
          <li><i>${IK.tik}</i>Başvuruların size iletilmesi</li>
        </ul>
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
    <div class="bolum-bas bolum-bas-yan" data-goster>
      <h2 class="baslik-ikon">Ankara İş İlanı Sıcak <span class="sicak${yeniVar?' sicak-yeni':''}" role="img" aria-label="${yeniVar?'Yeni ilan var':'Güncel ilanlar'}">${IK.alev}</span>${yeniVar?'<span class="yeni-isaret">Yeni</span>':''}</h2>
      <a class="dugme dugme-hat" href="guncel-ilanlar.html">Tüm güncel ilanlar ${IK.ok}</a>
    </div>
    <div class="ilan-liste">
${secilen.map(i=>satir(i)).join('\n')}
    </div>
  </div>
</section>
${cagri()}`;
  yaz('index.html', sayfa({baslik:"Ankara İş İlanı | Ücretsiz İlan Verin, Eleman Bulun",
    aciklama:"Ankara'da eleman arıyorsanız ilanınızı ücretsiz yayınlayalım. İlanınız sitemizde, Instagram'da ve Facebook sayfamızda yer alır. Üyelik gerekmez.",
    yol:'',ld:[ORG,{'@context':'https://schema.org','@type':'WebSite',name:'Ankara İş İlanı',url:SITE,inLanguage:'tr-TR'}],aktif:'ana',govde}));
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
  yaz('guncel-ilanlar.html', sayfa({baslik:`Güncel İş İlanları | Ankara İş İlanı`,
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
      ${acilir({id:'ilce-suz',yer:'İlçe seçin',tumu:'Tüm ilçeler',secenekler:ilceler,varyant:'acilir-pill',oznitelik:'data-ilce-sec'})}
    </div>
    <div class="ilan-liste" data-suzulecek>
${ilanlar.map(i=>satir(i)).join('\n')}
    </div>
    <p class="liste-bos" data-bos hidden>Bu süzgece uyan ilan yok. Süzgeci değiştirin ya da ilan veren işverenlerden biri olun.</p>
  </div>
</section>
${cagri()}`;
  yaz('genel-ilanlar.html', sayfa({baslik:'Genel İş İlanları | Ankara İş İlanı',
    aciklama:"Ankara iş ilanlarını sektöre ve ilçeye göre süzün: satış, üretim, temizlik, kurye, servis ve ön büro ilanları tek sayfada.",
    yol:'genel-ilanlar.html',ld:[yolIzi([{ad:'Ana Sayfa',yol:''},{ad:'Genel İlanlar',yol:'genel-ilanlar.html'}])],aktif:'genel',govde}));
}

/* ——— 4. HAKKIMIZDA ——— */
{
  const govde=`${sayfaBas({yol:yolBas('', 'Hakkımızda'),baslik:"Ankara'da iş arayanla eleman arayan burada buluşuyor",
    lead:"Ankara İş İlanı, Ankara'daki işverenlerle iş arayanları tek çatıda buluşturan bir ilan platformudur. Üç ayrı kanaldaki topluluğumuz, ilanların ulaşabileceği geniş bir kitle oluşturur."})}
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
  yaz('hakkimizda.html', sayfa({baslik:'Hakkımızda | Ankara İş İlanı',
    aciklama:"Ankara İş İlanı: 41 binden fazla üyeli Facebook grubu, Facebook sayfası ve LinkedIn topluluğuyla Ankara'da işverenle iş arayanı buluşturan ilan platformu.",
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
        <li><a href="${FB_SAYFA}" target="_blank" rel="noopener" data-sosyal="facebook_sayfa"><span class="ik">${IK.fb.replace('<svg','<svg fill="#3B46F2"')}</span><span><b>Facebook sayfası</b><small>@ankaraisilanicom</small></span></a></li>
        <li><a href="${INSTAGRAM}" target="_blank" rel="noopener" data-sosyal="instagram"><span class="ik">${IK.ig.replace('<svg','<svg fill="#3B46F2"')}</span><span><b>Instagram</b><small>@ankaraisilanicom</small></span></a></li>
        <li><a href="${LINKEDIN}" target="_blank" rel="noopener" data-sosyal="linkedin"><span class="ik">${IK.in.replace('<svg','<svg fill="#3B46F2"')}</span><span><b>LinkedIn</b><small>Ankara İş İlanı</small></span></a></li>
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
  yaz('iletisim.html', sayfa({baslik:'İletişim | Ankara İş İlanı',
    aciklama:`Ankara İş İlanı ile iletişime geçin: ilan vermek, sahte ilan bildirmek ya da soru sormak için ${EPOSTA} adresine yazın.`,
    yol:'iletisim.html',ld:[ORG,yolIzi([{ad:'Ana Sayfa',yol:''},{ad:'İletişim',yol:'iletisim.html'}])],aktif:'iletisim',govde}));
}

/* ——— 6. İLAN VER (işveren formu) ——— */
{
  const govde=`${sayfaBas({yol:yolBas('', 'Ücretsiz İlan Ver'),baslik:'İlanınızı ücretsiz yayınlayalım',
    lead:"Formu doldurun, ilanınızı kontrol edip sitemizde, Instagram'da, Facebook sayfamızda ve LinkedIn'de yayınlayalım.",leadSinif:'lead-tek'})}
<section class="bolum">
  <div class="kap ikili ikili-dar ikili-form">
    <div class="panel panel-form">
      <form class="form" id="ilan-formu" novalidate>
        <div class="form-bolum">
          <h2 class="form-baslik">İletişim bilgileri</h2>
          <div class="form-ikili">
            <div class="alan"><label for="firma">Firma veya yetkili adı</label><input id="firma" name="firma" type="text" autocomplete="organization"><p class="hata">Firma veya yetkili adını yazın.</p></div>
            <div class="alan"><label for="telefon">Telefon <span class="not">(ilanda yayınlanmaz)</span></label><input id="telefon" name="telefon" type="tel" autocomplete="tel" inputmode="tel"><p class="hata">Size ulaşabileceğimiz bir telefon yazın.</p></div>
          </div>
          <div class="alan"><label for="eposta">E-posta</label><input id="eposta" name="eposta" type="email" autocomplete="email"><p class="hata">Geçerli bir e-posta adresi yazın.</p></div>
        </div>
        <div class="form-bolum">
          <h2 class="form-baslik">İlan bilgileri</h2>
          <div class="form-ikili">
            <div class="alan"><label for="pozisyon">Aradığınız pozisyon</label><input id="pozisyon" name="pozisyon" type="text" placeholder="Örnek: Kasiyer"><p class="hata">Aradığınız pozisyonu yazın.</p></div>
            <div class="alan"><span class="etiket" id="ilce-etiket">Çalışma yeri (ilçe)</span>${acilir({id:'ilce',ad:'ilce',yer:'İlçeyi seçin',secenekler:ILCELER})}<p class="hata">İlçeyi seçin.</p></div>
          </div>
          <div class="form-segmentler">
            ${segment({ad:'calisma',baslik:'Çalışma şekli',secenekler:['Tam zamanlı','Yarı zamanlı','Vardiyalı'],renk:'mavi'})}
            ${segment({ad:'sigorta',baslik:'Sigortalı çalışma',secenekler:['Var','Yok'],renk:'sari'})}
          </div>
          <div class="alan"><label for="ucret">Ücret <span class="not">(isteğe bağlı)</span></label><input id="ucret" name="ucret" type="text" placeholder="Örnek: 33.000 TL"></div>
          <div class="alan"><label for="aciklama">İş tanımı ve şartlar</label><textarea id="aciklama" name="aciklama" placeholder="Çalışma saatleri, yemek, servis gibi bilgileri yazın."></textarea><p class="hata">İş tanımını ve şartları yazın (en az 20 karakter).</p></div>
        </div>
        <div class="alan"><label class="onay"><input type="checkbox" name="kvkk"><span><a href="gizlilik.html" target="_blank">Gizlilik ve KVKK bildirimini</a> okudum.</span></label><p class="hata">Devam etmek için bildirimi okuduğunuzu onaylayın.</p></div>
        <div class="tuzak" aria-hidden="true"><label for="web_sitesi">Web siteniz</label><input id="web_sitesi" name="web_sitesi" type="text" tabindex="-1" autocomplete="off"></div>
        <button class="dugme dugme-mavi dugme-tam" type="submit">İlanı gönder ${IK.ok}</button>
        <div class="form-sonuc" id="form-sonuc" tabindex="-1" role="status"></div>
      </form>
    </div>
    <aside class="panel panel-yuzey panel-yapisik">
      <h2 class="kontrol-baslik">Yayından önce neleri kontrol ediyoruz?</h2>
      <ul class="kontrol kontrol-tek">
        <li><span class="im im-evet" aria-hidden="true">✓</span><span>Adaydan ücret talebi olmaması</span></li>
        <li><span class="im im-evet" aria-hidden="true">✓</span><span>Cinsiyet ve yaş şartı ifadelerinin çıkarılması</span></li>
        <li><span class="im im-evet" aria-hidden="true">✓</span><span>İş yeri, saat ve şartların açık yazılması</span></li>
        <li><span class="im im-evet" aria-hidden="true">✓</span><span>Pozisyon, ilçe ve çalışma şeklinin belirtilmesi</span></li>
        <li><span class="im im-evet" aria-hidden="true">✓</span><span>Aynı ilanın ikinci kez yayınlanmaması</span></li>
        <li><span class="im im-evet" aria-hidden="true">✓</span><span>Telefon numaranızın ilanda yayınlanmaması</span></li>
      </ul>
      <p class="kontrol-not">Başvurular size bizim üzerimizden iletilir.</p>
    </aside>
  </div>
</section>`;
  yaz('ilan-ver.html', sayfa({baslik:'Ücretsiz İlan Ver | Ankara İş İlanı',
    aciklama:"Ankara'da eleman arıyorsanız ilanınızı ücretsiz verin. Formu doldurun, ilanınızı sitemizde, Instagram'da, Facebook'ta ve LinkedIn'de yayınlayalım.",
    yol:'ilan-ver.html',ld:[yolIzi([{ad:'Ana Sayfa',yol:''},{ad:'Ücretsiz İlan Ver',yol:'ilan-ver.html'}])],govde}));
}

/* ——— 7. GİZLİLİK VE KVKK ——— */
{
  const govde=`${sayfaBas({yol:yolBas('', 'Gizlilik ve KVKK'),baslik:'Gizlilik, KVKK ve çerez bildirimi',lead:'Hangi bilgileri neden işlediğimizi ve tercihlerinizi nasıl değiştirebileceğinizi burada açıkça yazıyoruz. Son güncelleme: 11 Kasım 2026.'})}
<section class="bolum">
  <div class="kap yazi">
    <h2>Veri sorumlusu</h2>
    <p>Bu sitenin veri sorumlusu Ankara İş İlanı'dır. Bize ${EPOSTA} adresinden ulaşabilirsiniz.</p>
    <h2>Hangi bilgileri işliyoruz?</h2>
    <p><strong>İlan formu:</strong> firma veya yetkili adı, telefon, e-posta ve ilanla ilgili bilgiler. Formu gönderdiğinizde bu bilgiler, ilanınızı değerlendirebilmemiz için Google E-Tablolar'daki (Google LLC) ilan listemize kaydedilir. Kaydın yanına reklamdan ya da başka bir siteden geldiyseniz o kaynağın adı da yazılır.</p>
    <p><strong>İlana başvuru formu:</strong> ad soyad, telefon ve isteğe bağlı kısa not. Başvuruyu gönderdiğinizde bu bilgiler, başvurunuzu ilgili işverene iletebilmemiz için Google E-Tablolar'daki (Google LLC) başvuru listemize kaydedilir ve işverene iletilir. Kaydın yanına başvurduğunuz ilanın kodu ve geldiğiniz kaynağın adı da yazılır.</p>
    <p><strong>E-postalar:</strong> bize yazdığınız iletiler ve içindeki bilgiler.</p>
    <p><strong>Çerezler:</strong> sayfa görüntüleme, tıklama, cihaz ve tarayıcı bilgisi gibi kullanım verileri.</p>
    <h2>Neden işliyoruz?</h2>
    <p>İlanınızı değerlendirmek, yayınlamak ve sizinle iletişim kurmak için. Çerez onayı verirseniz ayrıca sitemizin nasıl kullanıldığını ölçmek ve ilan reklamlarımızın etkisini değerlendirmek için.</p>
    <h2>Çerezler</h2>
    <p><strong>Gerekli çerez bilgisi:</strong> çerez tercihinizi tarayıcınızda saklarız. Bunun için onayınız aranmaz.</p>
    <p><strong>Analiz ve reklam ölçümü:</strong> Google Analytics ve Meta (Facebook, Instagram) ölçüm araçlarını yalnız “Tümünü kabul et” seçeneğini seçerseniz çalıştırırız. “Yalnız gerekli olanlar” seçeneğinde bu araçlar çerez bırakmaz.</p>
        <p><strong>Sunucu taraflı Meta ölçümü:</strong> “Tümünü kabul et” seçeneğini seçtiyseniz sayfa görüntüleme, ilan formu gönderme ve başvuru tıklaması olayları sitemizin sunucusu üzerinden de Meta'nın Conversions API hizmetine iletilir. Bu iletide IP adresiniz, tarayıcı bilginiz, Meta çerezleriniz ve ziyaret ettiğiniz sayfanın adresi yer alır; ad, telefon ve e-posta yer almaz. “Yalnız gerekli olanlar” seçeneğini seçerseniz bu ileti gönderilmez.</p>
    <p><strong>Site reklamları (Google AdSense):</strong> Sitemizde Google AdSense reklam kodu bulunur. Kod, sayfa açıldığında Google'ın sunucusundan yüklenir; bu nedenle IP adresiniz ve tarayıcı bilginiz çerez tercihinizden bağımsız olarak Google'a ulaşır. Google'ın reklamlar için çerez ve benzeri teknolojileri nasıl kullandığını <a href="https://policies.google.com/technologies/ads" rel="noopener" target="_blank">Google reklam politikaları</a> sayfasında okuyabilir, kişiselleştirilmiş reklam tercihlerinizi <a href="https://adssettings.google.com/" rel="noopener" target="_blank">Google reklam ayarları</a> sayfasından yönetebilirsiniz.</p>
    <p>Tercihinizi istediğiniz zaman değiştirebilirsiniz: <a href="#" data-cerez-ac>çerez tercihlerini yeniden aç</a>.</p>
    <h2>Bilgiler yurt dışına aktarılır mı?</h2>
    <p>Google ve Meta hizmetleri yurt dışındaki sunucularda çalışır. Analiz ve ölçüm araçları yalnız çerez onayınız varsa çalışır; onay vermezseniz bu araçlar kullanım verilerinizi bu şirketlere iletmez. Google AdSense kodu bunun dışındadır, yukarıda açıkladık. İlan formunu ya da ilana başvuru formunu gönderdiğinizde ise formdaki bilgiler, çerez tercihinizden bağımsız olarak Google E-Tablolar'da saklanır; Google'ın sunucuları yurt dışında olabilir.</p>
    <h2>Ne kadar saklıyoruz?</h2>
    <p>İlan bilgilerini ilan yayında olduğu sürece ve amacın gerektirdiği süre kadar saklarız. Sonrasında siler ya da anonim hâle getiririz.</p>
    <h2>Reklamlar</h2>
    <p>Reklamlarımızın kimlere, hangi ölçütlerle gösterildiğini <a href="reklam-aydinlatmasi.html">hedefli reklam aydınlatması</a> sayfasında açıkladık.</p>
    <h2>Haklarınız</h2>
    <p>6698 sayılı Kişisel Verilerin Korunması Kanunu'nun 11. maddesi kapsamındaki haklarınızı kullanmak için ${EPOSTA} adresine yazabilirsiniz.</p>
  </div>
</section>`;
  yaz('gizlilik.html', sayfa({baslik:'Gizlilik, KVKK ve Çerez Bildirimi | Ankara İş İlanı',
    aciklama:'Ankara İş İlanı gizlilik, KVKK ve çerez bildirimi: hangi bilgileri neden işlediğimiz ve çerez tercihlerinizi nasıl değiştirebileceğiniz.',
    yol:'gizlilik.html',ld:[yolIzi([{ad:'Ana Sayfa',yol:''},{ad:'Gizlilik ve KVKK',yol:'gizlilik.html'}])],govde}));
}

/* ——— 7b. HEDEFLİ REKLAM AYDINLATMASI (Ticari Reklam Yönetmeliği md.25/A) ——— */
{
  const govde=`${sayfaBas({yol:yolBas('', 'Hedefli reklam aydınlatması'),baslik:'Hedefli reklam aydınlatması',lead:'Reklamlarımızın kimlere, hangi ölçütlerle gösterildiğini ve tercihlerinizi nasıl değiştirebileceğinizi burada açıkça yazıyoruz. Son güncelleme: 11 Kasım 2026.'})}
<section class="bolum">
  <div class="kap yazi">
    <h2>Reklamlarımızı kim yayınlıyor?</h2>
    <p>Ankara İş İlanı, ücretsiz ilan hizmetini tanıtmak için Meta'nın (Facebook ve Instagram) reklam araçlarını kullanır. Reklamları yayınlayan Ankara İş İlanı'dır.</p>
    <h2>Reklamları kimlere gösteriyoruz?</h2>
    <p>Reklamlarımızı hedeflerken şu ölçütlerden bir ya da birkaçını kullanırız:</p>
    <ul>
      <li><strong>Konum:</strong> Ankara.</li>
      <li><strong>Yaş:</strong> yalnız 18 yaş ve üzeri. 18 yaşın altındaki kişilere reklam göstermiyoruz ve çocuklara ait verilerle profilleme yapmıyoruz.</li>
      <li><strong>İş ve işletme bilgisi:</strong> Meta'nın kendi sınıflandırmasındaki küçük işletme sahibi davranışı ve işveren unvanları.</li>
      <li><strong>Site ziyareti:</strong> çerez onayı vererek sitemizi ziyaret etmiş kişilere yeniden reklam gösterebiliriz.</li>
    </ul>
    <p>Ad, telefon ya da e-posta gibi kimlik bilgilerinizi reklam hedeflemesi için Meta'ya göndermiyoruz.</p>
    <h2>Reklam ölçümü nasıl çalışır?</h2>
    <p>Reklamlarımızın etkisini ölçmek için Meta ölçüm araçlarını (tarayıcıdaki piksel ve sunucu taraflı Conversions API) yalnız “Tümünü kabul et” seçeneğini seçerseniz çalıştırırız. “Yalnız gerekli olanlar” seçeneğini seçerseniz bu araçlar çalışmaz. Ayrıntılar için <a href="gizlilik.html">Gizlilik, KVKK ve Çerez Bildirimi</a> sayfamıza bakın.</p>
    <h2>Bir reklamı neden gördüğümü nasıl öğrenirim?</h2>
    <p>Facebook ve Instagram'da reklamın üç nokta menüsünden “Bu reklamı neden görüyorum?” seçeneğini kullanabilirsiniz.</p>
    <h2>Tercihlerimi nasıl değiştiririm?</h2>
    <ul>
      <li>Meta hesabınızdaki reklam tercihlerini <a href="https://www.facebook.com/adpreferences/ad_settings" target="_blank" rel="noopener">Meta reklam tercihleri</a> sayfasından değiştirebilirsiniz.</li>
      <li>Sitemizdeki ölçüm tercihini <a href="#" data-cerez-ac>çerez tercihlerini yeniden açarak</a> değiştirebilirsiniz.</li>
      <li>Sorularınız için <a href="iletisim.html">iletişim</a> sayfamızı kullanabilirsiniz.</li>
    </ul>
  </div>
</section>`;
  yaz('reklam-aydinlatmasi.html', sayfa({baslik:'Hedefli Reklam Aydınlatması | Ankara İş İlanı',
    aciklama:'Ankara İş İlanı reklamlarının kimlere, hangi ölçütlerle gösterildiği ve reklam tercihlerinizi nasıl değiştirebileceğiniz.',
    yol:'reklam-aydinlatmasi.html',ld:[yolIzi([{ad:'Ana Sayfa',yol:''},{ad:'Hedefli reklam aydınlatması',yol:'reklam-aydinlatmasi.html'}])],govde}));
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
/* Bölüm alanları: h (başlık), p (paragraflar), liste (madde işaretli), tablo {b: başlıklar, s: satırlar} */
const tabloHtml = t => `    <div class="tablo-kap"><table>
      <thead><tr>${t.b.map(x=>`<th scope="col">${kac(x)}</th>`).join('')}</tr></thead>
      <tbody>
${t.s.map(r=>`        <tr>${r.map((x,n)=>n===0?`<th scope="row">${x}</th>`:`<td>${x}</td>`).join('')}</tr>`).join('\n')}
      </tbody>
    </table></div>`;
const bolumHtml = b => [`    <h2>${kac(b.h)}</h2>`,
  ...(b.p||[]).map(p=>`    <p>${p}</p>`),
  b.liste?`    <ul class="yazi-liste">\n${b.liste.map(l=>`      <li>${l}</li>`).join('\n')}\n    </ul>`:'',
  b.tablo?tabloHtml(b.tablo):''].filter(Boolean).join('\n');
for (const y of yazi) {
  const kat = KATEGORI[y.kategori];
  const g = yaziGorsel(y);
  const guncel = y.guncelleme || y.tarih;
  const secili = (y.ilgili||[]).map(sl=>yazi.find(x=>x.slug===sl)).filter(Boolean);
  const digerleri = [...secili, ...yazi.filter(x=>x.slug!==y.slug && x.kategori===y.kategori && !secili.includes(x))].slice(0,3);
  const resimLd = g ? {'@type':'ImageObject',url:`${SITE}/${g.jpg}`,contentUrl:`${SITE}/${g.jpg}`,width:1200,height:630,
      name:y.baslik,caption:g.alt,creator:{'@type':'Organization',name:'Ankara İş İlanı'},copyrightNotice:'© 2026 Ankara İş İlanı'} : undefined;
  const ld=[{'@context':'https://schema.org','@type':'Article',headline:y.baslik,description:y.ozet,
      datePublished:y.tarih,dateModified:guncel,inLanguage:'tr-TR',
      ...(resimLd?{image:resimLd,thumbnailUrl:`${SITE}/${g.webp800}`}:{}),
      ...(y.anahtar?{keywords:y.anahtar.join(', ')}:{}),
      ...(y.kaynaklar?{citation:y.kaynaklar.map(k=>({'@type':'CreativeWork',name:k.ad,url:k.url}))}:{}),
      articleSection:kat.ad,
      author:{'@type':'Organization',name:'Ankara İş İlanı',url:`${SITE}/hakkimizda`},publisher:ORG,
      mainEntityOfPage:{'@type':'WebPage','@id':`${SITE}/${yaziYol(y)}`}},
    {'@context':'https://schema.org','@type':'FAQPage',inLanguage:'tr-TR',
      mainEntity:(y.sss||[]).map(q=>({'@type':'Question',name:q.s,acceptedAnswer:{'@type':'Answer',text:duz(q.c)}}))},
    yolIzi([{ad:'Ana Sayfa',yol:''},{ad:kat.ad,yol:kat.dosya},{ad:y.baslik,yol:yaziYol(y)}])];
  const govde=`${sayfaBas({yol:yolBas('../', `<a href="../${kat.dosya}">${kac(kat.ad)}</a>`),baslik:kac(y.baslik),lead:`${kac(y.ozet)}`,gorsel:g?oneCikan(g):''})}
<section class="bolum">
  <div class="kap yazi">
    <p class="yazi-kunye">Hazırlayan: <a href="../hakkimizda.html">Ankara İş İlanı</a> · Yayın: <time datetime="${y.tarih}">${trTarih(y.tarih)}</time>${guncel!==y.tarih?` · Güncelleme: <time datetime="${guncel}">${trTarih(guncel)}</time>`:''} · ${y.okuma} dakikalık okuma</p>
${y.kisa?`    <div class="kisa-cevap"><strong>Kısa cevap:</strong> ${y.kisa}</div>`:''}
${y.bolumler.map(bolumHtml).join('\n')}
${y.uyari?`    <p class="yazi-uyari">${y.uyari}</p>`:''}
    <div class="panel panel-yuzey" style="margin-top:2rem">
      <h3>Kısaca</h3>
      <ul class="kontrol">
        <li><span class="im im-evet" aria-hidden="true">✓</span><span>Gerçek işveren, işe alacağı kişiden para istemez.</span></li>
        <li><span class="im im-evet" aria-hidden="true">✓</span><span>Çalışma yeri, saati ve ücreti işe başlamadan yazılı hâle gelmeli.</span></li>
        <li><span class="im im-hayir" aria-hidden="true">✕</span><span>Kimlik ve IBAN bilgisi görüşme öncesi paylaşılmaz.</span></li>
      </ul>
      <p style="margin:1.1rem 0 0"><a class="dugme dugme-mavi" href="../guncel-ilanlar.html">Güncel ilanlara bakın</a></p>
    </div>
${y.kaynaklar?.length?`    <div class="kaynaklar">
      <h2>Kaynaklar</h2>
      <ul>
${y.kaynaklar.map(k=>`        <li><a href="${k.url}" rel="noopener" target="_blank">${kac(k.ad)}</a></li>`).join('\n')}
      </ul>
    </div>`:''}
  </div>
</section>
${sssBlok(y.sss)}
${digerleri.length?`<section class="bolum bolum-yuzey">
  <div class="kap">
    <div class="bolum-bas"><h2>Bu konudaki diğer yazılar</h2></div>
    <div class="izgara-3">
${digerleri.map(d=>yaziKart(d,'../')).join('\n')}
    </div>
  </div>
</section>`:''}
${cagri('../')}`;
  yaz(yaziYol(y), sayfa({baslik:(y.baslik.length+22<=60?`${y.baslik} | Ankara İş İlanı`:y.baslik),aciklama:y.ozet,yol:yaziYol(y),ld,k:'../',govde,
    og:g?{...g,yayin:y.tarih,guncel,bolum:kat.ad}:null}));
}

/* ——— 10. İLAN SAYFALARI ——— */
for (const i of ilanlar) {
  const benzer = ilanlar.filter(x=>x.kod!==i.kod && (x.ilce===i.ilce||x.kategori===i.kategori)).slice(0,3);
  const ld=[{'@context':'https://schema.org','@type':'JobPosting',title:i.baslik,description:i.aciklama,
      datePosted:i.tarih,employmentType:i.calisma==='Tam zamanlı'?'FULL_TIME':'PART_TIME',
      hiringOrganization:{'@type':'Organization',name:'Ankara İş İlanı',sameAs:SITE},
      jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressLocality:i.ilce,addressRegion:'Ankara',addressCountry:'TR',streetAddress:i.semt}},
      directApply:false,inLanguage:'tr-TR',
      identifier:{'@type':'PropertyValue',name:'Ankara İş İlanı',value:i.kod}},
    yolIzi([{ad:'Ana Sayfa',yol:''},{ad:'Güncel İlanlar',yol:'guncel-ilanlar.html'},{ad:i.baslik,yol:ilanYol(i)}])];
  const govde=`${sayfaBas({yol:yolBas('../', `<a href="../guncel-ilanlar.html">Güncel İlanlar</a>`),baslik:kac(i.baslik),lead:kac(i.aciklama),
    eylem:`<a class="dugme dugme-sari" href="#basvuru-formu" data-yer="basvuru_forma_git">Bu ilana başvurun ${IK.ok}</a><a class="dugme dugme-hat" href="../guncel-ilanlar.html">Diğer ilanlar</a>`})}
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
<section class="bolum" id="basvuru-formu">
  <div class="kap">
    <div class="panel panel-form basvuru-panel">
      <form class="form" id="basvuru-form" data-ilan-kodu="${kac(i.kod)}" data-ilan-baslik="${kac(i.baslik)}" novalidate>
        <div class="form-bolum">
          <h2 class="form-baslik">Bu ilana başvurun</h2>
          <div class="form-ikili">
            <div class="alan"><label for="b-ad">Ad soyad</label><input id="b-ad" name="ad" type="text" autocomplete="name"><p class="hata">Adınızı ve soyadınızı yazın.</p></div>
            <div class="alan"><label for="b-telefon">Telefon</label><input id="b-telefon" name="telefon" type="tel" autocomplete="tel" inputmode="tel"><p class="hata">Size ulaşabileceğimiz bir telefon yazın.</p></div>
          </div>
          <div class="alan"><label for="b-not">Kısa not <span class="not">(isteğe bağlı)</span></label><textarea id="b-not" name="not" placeholder="Tecrübenizi ya da uygun olduğunuz saatleri yazabilirsiniz."></textarea></div>
        </div>
        <div class="alan"><label class="onay"><input type="checkbox" name="kvkk"><span><a href="/gizlilik" target="_blank">Gizlilik ve KVKK bildirimini</a> okudum. Bilgilerimin işverene iletilmesini kabul ediyorum.</span></label><p class="hata">Devam etmek için bildirimi okuduğunuzu onaylayın.</p></div>
        <div class="tuzak" aria-hidden="true"><label for="b-web">Web siteniz</label><input id="b-web" name="web_sitesi" type="text" tabindex="-1" autocomplete="off"></div>
        <button class="dugme dugme-sari dugme-tam" type="submit">Başvuruyu gönder ${IK.ok}</button>
        <div class="form-sonuc" id="basvuru-sonuc" tabindex="-1" role="status"></div>
      </form>
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

/* ——— 10a. İLAN GÖNDERİLDİ (teşekkür sayfası; Meta özel dönüşümü ve GA4 ilan_ver_gonder bu adreste) ——— */
yaz('ilan-gonderildi.html', sayfa({baslik:'İlanınız bize ulaştı | Ankara İş İlanı',aciklama:'İlanınız Ankara İş İlanı ekibine ulaştı. Kontrol edildikten sonra sitemizde ve sosyal medya hesaplarımızda yayınlanır.',yol:'ilan-gonderildi.html',k:'/',robots:'noindex,nofollow',
  govde:`${sayfaBas({yol:'',baslik:'İlanınız bize ulaştı',lead:'Kontrol edip sitemizde ve sosyal medya hesaplarımızda yayınlayacağız. Gerekirse verdiğiniz telefondan size ulaşırız.',eylem:'<a class="dugme dugme-sari" href="/guncel-ilanlar">Güncel ilanlar</a><a class="dugme dugme-hat" href="/ilan-ver">Yeni ilan ver</a>'})}`}));

/* ——— 10b. 404 ——— */
yaz('404.html', sayfa({baslik:'Sayfa bulunamadı | Ankara İş İlanı',aciklama:'Aradığınız sayfa bulunamadı. Ana sayfaya dönebilir ya da güncel ilanlara bakabilirsiniz.',yol:'404.html',k:'/',robots:'noindex,follow',
  govde:`${sayfaBas({yol:'',baslik:'Bu sayfayı bulamadık',lead:'Adres değişmiş ya da yanlış yazılmış olabilir. Aşağıdaki sayfalardan devam edebilirsiniz.',eylem:'<a class="dugme dugme-sari" href="/index.html">Ana sayfa</a><a class="dugme dugme-hat" href="/guncel-ilanlar.html">Güncel ilanlar</a>'})}`}));

/* ——— 11. SITEMAP ——— */
const sayfalar=[
  ['',1.0,'daily'],['guncel-ilanlar.html',0.95,'daily'],['genel-ilanlar.html',0.9,'daily'],['ilan-ver.html',0.9,'monthly'],
  ['hakkimizda.html',0.6,'monthly'],['iletisim.html',0.6,'monthly'],['ek-is-ilanlari.html',0.8,'weekly'],['evde-paketleme-isi.html',0.8,'weekly'],['gizlilik.html',0.3,'yearly'],['reklam-aydinlatmasi.html',0.3,'yearly'],
  ...yazi.map(y=>[yaziYol(y),0.7,'monthly']),
  ...ilanlar.map(i=>[ilanYol(i),0.7,'weekly'])];
yaz('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${sayfalar.map(([s,p,f])=>{ const y=yazi.find(x=>yaziYol(x)===s); const g=y&&yaziGorsel(y);
  return `  <url><loc>${SITE}/${s.replace(/\.html$/,'')}</loc><lastmod>${y?(y.guncelleme||y.tarih):bugun}</lastmod><changefreq>${f}</changefreq><priority>${p}</priority>${g?`<image:image><image:loc>${SITE}/${g.jpg.replace(/&/g,'&amp;')}</image:loc></image:image>`:''}</url>`; }).join('\n')}
</urlset>`);

console.log(`✓ üretildi: ana sayfa · güncel · genel · hakkımızda · iletişim · ilan ver · gizlilik · 2 rehber kategorisi · ${yazi.length} yazı · ${ilanlar.length} ilan sayfası · sitemap (${sayfalar.length} adres)`);
