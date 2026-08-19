#!/usr/bin/env node
/* Ankara İş İlanları — site üreteci (tek kaynak)
   veri/ilanlar.json  → Güncel İlanlar panosu + tek ilan sayfaları (JobPosting)
   veri/yazilar.json  → Ek İş İlanları ve Evde Paketleme İşi kategorileri + makaleler (Article + FAQPage)
   Çalıştır: node _uret.mjs */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
/* Alan adı alınınca tek satır değişir: SITE_URL ortam değişkeni ya da buradaki varsayılan.
   Canonical adresin yayında olmayan bir alan adını göstermesi indekslemeyi engeller. */
const SITE = process.env.SITE_URL || 'https://isilanlari.vercel.app';
const oku = p => fs.readFileSync(path.join(KOK,p),'utf8');
const yaz = (p,s) => { fs.mkdirSync(path.dirname(path.join(KOK,p)),{recursive:true}); fs.writeFileSync(path.join(KOK,p),s); };
/* JSON-LD gövdesi kullanıcıdan gelen metin taşıyabilir: script kapatmasını ve satır ayırıcıları etkisizleştir */
const ldGuvenli = o => JSON.stringify(o).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const kac = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const duz = s => String(s).replace(/<[^>]+>/g,'');
const TR = {'ç':'c','Ç':'c','ğ':'g','Ğ':'g','ı':'i','I':'i','İ':'i','ö':'o','Ö':'o','ş':'s','Ş':'s','ü':'u','Ü':'u'};
const slug = s => s.split('').map(c=>TR[c]??c).join('').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

const veri  = JSON.parse(oku('veri/ilanlar.json'));
const yazi  = JSON.parse(oku('veri/yazilar.json')).yazilar;
const ilanlar = veri.ilanlar, bugun = veri.guncelleme;
const trTarih = t => new Date(t+'T00:00:00+03:00').toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'});
const ilanYol = i => `ilan/${slug(i.baslik)}-${i.kod.toLowerCase()}.html`;
const yaziYol = y => `yazi/${y.slug}.html`;

const KATEGORI = {
  'ek-is-ilanlari':   {dosya:'ek-is-ilanlari.html',  ad:'Ek İş İlanları',      anahtar:'ek iş ilanları',
    baslik:'Ek İş İlanları — Ankara\'da akşam ve hafta sonu ek iş',
    ozet:'Ankara\'da ek iş nerelerde çıkar, ne kadar kazandırır, nelere dikkat edilir? Düzenli yayınladığımız rehberler burada.',
    girisBaslik:'Mesai bitince<br><span class="vurgu-cizgi">başlayan işler</span>',
    giris:'Ek iş, mevcut işinizin ya da okulunuzun üzerine akşam veya hafta sonu yaptığınız iştir. Bu bölümde ek iş arayanlar için yazdığımız rehberler var: iş hangi alanlarda çıkıyor, kazanç nasıl hesaplanır, hangi teklife mesafe konur. Güncel ilanları görmek için <a href="guncel-ilanlar.html">Güncel İlanlar</a> sayfasına bakın.'},
  'evde-paketleme-isi':{dosya:'evde-paketleme-isi.html', ad:'Evde Paketleme İşi', anahtar:'evde paketleme işi',
    baslik:'Evde Paketleme İşi — güvenilir mi, ne kadar kazandırır?',
    ozet:'Evde paketleme işi güvenilir mi, dolandırıcılık nasıl anlaşılır, gerçek fason paketleme nasıl yürür? Koruyucu bilgilendirme yazıları.',
    girisBaslik:'Evde paketleme işi<br><span class="vurgu-cizgi">güvenilir mi?</span>',
    giris:'Tek cümlelik cevap: <strong>işe başlamak için sizden para isteniyorsa o iş gerçek değildir.</strong> Bu bölümde sahte teklifin işaretlerini, gerçek paketleme işinin nasıl yürüdüğünü ve mağdur olunca izlenecek yolu yazıyoruz. Bu sayfalar bilgilendirmedir, iş vaadi içermez.'}
};

/* ——— ortak parçalar ——— */
const kafa = (baslik,aciklama,kanonik,ld=[],k='') => `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${kac(baslik)}</title>
<meta name="description" content="${kac(aciklama)}">
<link rel="canonical" href="${kanonik}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<meta property="og:site_name" content="Ankara İş İlanları">
<meta property="og:title" content="${kac(baslik)}">
<meta property="og:description" content="${kac(aciklama)}">
<meta property="og:locale" content="tr_TR">
<meta property="og:url" content="${kanonik}">
<meta name="twitter:card" content="summary">
<meta name="geo.region" content="TR-06">
<meta name="geo.placename" content="Ankara">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${k}stil.css">
${ld.map(x=>`<script type="application/ld+json">${ldGuvenli(x)}</script>`).join('\n')}
</head>`;

const menu = (aktif,k='') => `
<header class="ust">
  <div class="kap ust-ic">
    <a class="marka" href="${k}index.html"><span class="marka-im" aria-hidden="true">Aİİ</span> Ankara İş İlanları</a>
    <nav class="menu" aria-label="Ana menü">
      <a href="${k}index.html"${aktif==='ana'?' aria-current="page"':''}>Ana Sayfa</a>
      <a href="${k}ek-is-ilanlari.html"${aktif==='ek-is-ilanlari'?' aria-current="page"':''}>Ek İş İlanları</a>
      <a href="${k}evde-paketleme-isi.html"${aktif==='evde-paketleme-isi'?' aria-current="page"':''}>Evde Paketleme İşi</a>
      <a href="${k}guncel-ilanlar.html"${aktif==='guncel'?' aria-current="page"':''}>Güncel İlanlar</a>
    </nav>
  </div>
</header>`;

const dip = (k='') => `
<footer class="alt">
  <div class="kap">
    <div class="alt-izgara">
      <div>
        <a class="marka" href="${k}index.html" style="margin-bottom:.7rem"><span class="marka-im" aria-hidden="true">Aİİ</span> Ankara İş İlanları</a>
        <p style="max-width:42ch">Ankara'da iş arayanla eleman arayanı buluşturuyoruz. Aday hiçbir aşamada para ödemez.</p>
      </div>
      <div>
        <p class="ustbaslik">Sayfalar</p>
        <ul class="alt-liste">
          <li><a href="${k}index.html">Ana Sayfa</a></li>
          <li><a href="${k}ek-is-ilanlari.html">Ek İş İlanları</a></li>
          <li><a href="${k}evde-paketleme-isi.html">Evde Paketleme İşi</a></li>
          <li><a href="${k}guncel-ilanlar.html">Güncel İlanlar</a></li>
        </ul>
      </div>
      <div>
        <p class="ustbaslik">İletişim</p>
        <ul class="alt-liste">
          <li><a href="mailto:ankaraisilanlari@outlook.com">ankaraisilanlari@outlook.com</a></li>
          <li><a href="https://www.instagram.com/ankaraisilanlaricomtr/" rel="me">Instagram</a></li>
          <li><a href="https://www.facebook.com/ankaraisilanlaricomtr/" rel="me">Facebook sayfası</a></li>
        </ul>
      </div>
    </div>
    <div class="alt-kunye">
      <span>© 2026 Ankara İş İlanları</span>
      <span>İş bulma vaadinde bulunmuyoruz, ilanları yayınlıyoruz.</span>
    </div>
  </div>
</footer>
</body>
</html>`;

const satir = (i,g,k='') => `      <a class="ilan" href="${k}${ilanYol(i)}" style="animation-delay:${g.toFixed(2)}s">
        <span class="ilan-serit" aria-hidden="true">${kac(i.kod)}</span>
        <span>
          <span class="ilan-baslik">${kac(i.baslik)}</span>
          <span class="ilan-alt">${kac(i.ilce)} <i class="ayrac" aria-hidden="true"></i> ${kac(i.calisma)} <i class="ayrac" aria-hidden="true"></i> ${i.sigorta?'Sigortalı':'Vardiyalı'}</span>
        </span>
        <span class="rozet">✓ Ücret talebi yok</span>
      </a>`;

const yaziKart = (y,k='') => `      <a class="kart kart-bag" href="${k}${yaziYol(y)}">
        <p class="ustbaslik" style="margin-bottom:.3rem">${KATEGORI[y.kategori].ad} · ${y.okuma} dakika</p>
        <h3>${kac(y.baslik)}</h3>
        <p>${kac(y.ozet)}</p>
        <span class="kart-ok">Yazıyı okuyun →</span>
      </a>`;

const sssBlok = (sss,k='') => !sss?.length ? '' : `
<section class="bolum bolum-hat">
  <div class="kap">
    <div class="bolum-bas"><h2 class="gorsel-baslik">Sık sorulanlar</h2></div>
    <div class="sc">
${sss.map((q,n)=>`      <details${n===0?' open':''}>
        <summary>${kac(q.s)}</summary>
        <p>${q.c}</p>
      </details>`).join('\n')}
    </div>
  </div>
</section>`;

const isverenSerit = (k='') => `
<section class="bolum bolum-hat">
  <div class="kap">
    <div class="serit">
      <div>
        <p class="ustbaslik" style="color:#B9BFC7">İşveren misiniz?</p>
        <h2 class="gorsel-baslik">İlanınız aynı gün üç yerde yayınlansın</h2>
        <p>İlanı bize gönderin: bu sitede kendi sayfasında, Instagram'da görsel olarak ve Facebook sayfamızda yayınlayalım.</p>
      </div>
      <a class="dugme dugme-vurgu" href="mailto:ankaraisilanlari@outlook.com?subject=${encodeURIComponent('İlan vermek istiyorum')}">İlanınızı gönderin</a>
    </div>
  </div>
</section>`;

const ORG = {'@context':'https://schema.org','@type':'Organization',name:'Ankara İş İlanları',url:SITE,
  email:'ankaraisilanlari@outlook.com',areaServed:{'@type':'City',name:'Ankara'},
  sameAs:['https://www.facebook.com/ankaraisilanlaricomtr/','https://www.instagram.com/ankaraisilanlaricomtr/'],
  description:"Ankara'da iş arayanla eleman arayanı buluşturan ilan sayfası. Adaydan ücret istenmez."};
const yolIzi = (parcalar) => ({'@context':'https://schema.org','@type':'BreadcrumbList',
  itemListElement:parcalar.map((p,n)=>({'@type':'ListItem',position:n+1,name:p.ad,item:`${SITE}/${p.yol}`}))});

/* ——— 1. ANA SAYFA ——— */
{
  const secilen = ilanlar.slice(0,5);
  const govde = `${kafa("Ankara İş İlanları | Güncel İş, Ek İş ve Part Time İlanları",
    "Ankara'daki güncel iş ilanları, ek iş rehberleri ve evde paketleme işi bilgilendirmesi. Sizden para isteyen ilanları yayınlamıyoruz.",
    SITE+'/', [ORG,{'@context':'https://schema.org','@type':'WebSite',name:'Ankara İş İlanları',url:SITE,inLanguage:'tr-TR'}])}
<body>
${menu('ana')}
<main>
<section class="hero">
  <div class="kap hero-izgara">
    <div class="hero-tez">
      <p class="ustbaslik">Ankara · güncel ilan panosu</p>
      <h1 class="gorsel-baslik">Ankara'da iş bulun,<br><span class="vurgu-cizgi">dolandırılmadan.</span></h1>
      <p class="giris" style="margin-top:1.4rem">Facebook sayfamıza her gün iş ilanı geliyor. Hepsini tek tek okuyoruz; sizden kapora, kargo ya da üyelik ücreti isteyen ilanları yayınlamıyoruz. Kalanı burada, Instagram'da ve Facebook sayfamızda paylaşıyoruz.</p>
      <div style="display:flex; gap:.7rem; flex-wrap:wrap; margin-top:1.5rem">
        <a class="dugme" href="guncel-ilanlar.html">Güncel ilanlara bakın</a>
        <a class="dugme dugme-vurgu" href="mailto:ankaraisilanlari@outlook.com?subject=${encodeURIComponent('İlan vermek istiyorum')}">Eleman arıyorum</a>
      </div>
    </div>
    <div class="pano" aria-labelledby="pano-baslik">
      <div class="pano-ust">
        <span class="kod" id="pano-baslik">Son yayınlananlar</span>
        <span class="kod canli"><span class="nokta" aria-hidden="true"></span> ${trTarih(bugun)}</span>
      </div>
${secilen.map((i,n)=>satir(i,0.05+n*0.07)).join('\n')}
      <div class="pano-ust" style="border-bottom:0; border-top:1px solid var(--hat)">
        <span class="kod">Panoda ${secilen.length} ilan gösteriliyor</span>
        <a class="kod" href="guncel-ilanlar.html" style="color:var(--murekkep); font-weight:500">Tümünü görün →</a>
      </div>
    </div>
  </div>
</section>

<section class="bolum">
  <div class="kap">
    <div class="bolum-bas">
      <h2 class="gorsel-baslik">Ne aradığınıza göre başlayın</h2>
      <p>İlanlar ile rehber yazıları ayrı tutuyoruz. İş arıyorsanız panoya, karar vermeden önce bilgi arıyorsanız rehberlere bakın.</p>
    </div>
    <div class="izgara-3">
      <a class="kart kart-bag" href="guncel-ilanlar.html">
        <p class="ustbaslik" style="margin-bottom:.3rem">Pano · ${ilanlar.length} ilan</p>
        <h3>Güncel ilanlar</h3>
        <p>Facebook sayfamıza gelen ilanlar. Mağaza, depo, temizlik, kurye, servis ve ön büro işleri; ilçeye göre bakabilirsiniz.</p>
        <span class="kart-ok">İlanları görün →</span>
      </a>
      <a class="kart kart-bag" href="ek-is-ilanlari.html">
        <p class="ustbaslik" style="margin-bottom:.3rem">Rehber · ${yazi.filter(y=>y.kategori==='ek-is-ilanlari').length} yazı</p>
        <h3>Ek iş ilanları</h3>
        <p>Akşam ve hafta sonu yapılabilecek işler, kazancın nasıl hesaplandığı ve hangi teklife mesafe konacağı.</p>
        <span class="kart-ok">Rehberlere bakın →</span>
      </a>
      <a class="kart kart-bag" href="evde-paketleme-isi.html">
        <p class="ustbaslik" style="margin-bottom:.3rem">Rehber · ${yazi.filter(y=>y.kategori==='evde-paketleme-isi').length} yazı</p>
        <h3>Evde paketleme işi</h3>
        <p>En çok sorulan konu ve en çok dolandırıcılığın olduğu alan. Gerçeği, sahtesini ve ayırt etme yolunu yazdık.</p>
        <span class="kart-ok">Yazıları okuyun →</span>
      </a>
    </div>
  </div>
</section>

<section class="bolum bolum-hat">
  <div class="kap izgara-2">
    <div>
      <p class="ustbaslik">Yayın kuralımız</p>
      <h2 class="gorsel-baslik">Sizden para isteyen ilanı yayınlamıyoruz</h2>
      <p style="margin-top:1.2rem">Ankara'da iş arayan en çok iki soruyu soruyor: “Bu ilan gerçek mi?” ve “Para isterlerse ne olacak?” Bu yüzden panoya giren her ilan aynı kontrolden geçiyor. Kural basit: işe girmek için sizden para isteniyorsa o ilan yayınlanmaz.</p>
      <p>İşveren tarafında da karşılığı var. İlanınız burada, Instagram'da ve Facebook sayfamızda aynı gün yayınlanıyor.</p>
    </div>
    <div class="uyari-blok">
      <h3>Panoya alınmayan ilanlar</h3>
      <ul class="liste-kontrol">
        <li><span class="im im-hayir" aria-hidden="true">✕</span> Kapora, depozito, kargo ya da sigorta ücreti isteyenler</li>
        <li><span class="im im-hayir" aria-hidden="true">✕</span> Üyelik, kayıt veya eğitim bedeli isteyenler</li>
        <li><span class="im im-hayir" aria-hidden="true">✕</span> Kimlik fotokopisi ve IBAN isteyip iş sözü verenler</li>
        <li><span class="im im-hayir" aria-hidden="true">✕</span> “Sermayesiz yüksek kazanç” diyenler</li>
      </ul>
      <h3 style="margin-top:1.6rem">Panoya alınan ilanlar</h3>
      <ul class="liste-kontrol">
        <li><span class="im im-evet" aria-hidden="true">✓</span> İşveren arıyor, aday para ödemiyor</li>
        <li><span class="im im-evet" aria-hidden="true">✓</span> İşin yeri, saati ve şartları belli</li>
        <li><span class="im im-evet" aria-hidden="true">✓</span> Başvuru doğrudan işverene gidiyor</li>
      </ul>
    </div>
  </div>
</section>

<section class="bolum bolum-hat">
  <div class="kap">
    <div class="bolum-bas"><h2 class="gorsel-baslik">Son yazılar</h2><p>Ek iş ve evde paketleme konusunda düzenli olarak rehber yayınlıyoruz.</p></div>
    <div class="izgara-3">
${yazi.slice(0,3).map(y=>yaziKart(y)).join('\n')}
    </div>
  </div>
</section>
${isverenSerit()}
</main>
${dip()}`;
  yaz('index.html',govde);
}

/* ——— 2. GÜNCEL İLANLAR ——— */
{
  const ilceler=[...new Set(ilanlar.map(i=>i.ilce))];
  const ld=[{'@context':'https://schema.org','@type':'ItemList',name:'Ankara güncel iş ilanları',numberOfItems:ilanlar.length,
    itemListElement:ilanlar.map((i,n)=>({'@type':'ListItem',position:n+1,url:`${SITE}/${ilanYol(i)}`,name:i.baslik}))},
    yolIzi([{ad:'Ana Sayfa',yol:''},{ad:'Güncel İlanlar',yol:'guncel-ilanlar.html'}])];
  const govde=`${kafa(`Güncel İlanlar | Ankara İş İlanları — ${ilanlar.length} ilan`,
    `Ankara'daki güncel iş ilanları: mağaza, depo, temizlik, kurye, servis ve ön büro. Facebook sayfamıza gelen ilanlar, ücret talebi kontrolünden geçirilerek yayınlanır.`,
    `${SITE}/guncel-ilanlar.html`, ld)}
<body>
${menu('guncel')}
<main>
<section class="hero">
  <div class="kap">
    <p class="ustbaslik">Pano · son güncelleme ${trTarih(bugun)}</p>
    <h1 class="gorsel-baslik" style="max-width:20ch">Ankara'da <span class="vurgu-cizgi">${ilanlar.length} güncel ilan</span></h1>
    <p class="giris" style="margin-top:1.4rem; max-width:72ch">Bu sayfadaki ilanlar Facebook sayfamıza gelen taleplerden derleniyor. Aday hiçbir aşamada para ödemez; kapora, kargo ya da üyelik ücreti isteyen ilanlar panoya girmez. Başvuru doğrudan işverene gider.</p>
    <div class="etiketler" style="margin-top:1.5rem">${ilceler.map(s=>`<span class="etiket">${kac(s)}</span>`).join(' ')}</div>
  </div>
</section>

<section class="bolum">
  <div class="kap">
    <div class="pano">
      <div class="pano-ust">
        <span class="kod">Tüm ilanlar</span>
        <span class="kod canli"><span class="nokta" aria-hidden="true"></span> ${trTarih(bugun)} itibarıyla</span>
      </div>
${ilanlar.map((i,n)=>satir(i,0.04+Math.min(n,8)*0.05)).join('\n')}
    </div>
  </div>
</section>

<section class="bolum bolum-hat">
  <div class="kap izgara-2">
    <div>
      <p class="ustbaslik">Başvurmadan önce</p>
      <h2 class="gorsel-baslik">İlanı üç soruyla tartın</h2>
      <p style="margin-top:1.2rem"><strong>Para isteniyor mu?</strong> İşe girmek için ödeme yapılmaz. İstenirse başvurmayın ve bize bildirin.</p>
      <p><strong>Yer ve saat belli mi?</strong> Çalışma yeri, vardiya ve ücret işe başlamadan netleşmeli.</p>
      <p><strong>Sigorta var mı?</strong> Yarı zamanlı çalışmada da işveren sigorta bildirimi yapmakla yükümlüdür.</p>
    </div>
    <div class="uyari-blok">
      <h3>Sahte ilan gördüyseniz</h3>
      <p>Panoda sizden para isteyen bir ilan görürseniz bize yazın. İlanı siteden, Instagram'dan ve Facebook sayfasından aynı gün kaldırıyoruz.</p>
      <a class="dugme dugme-vurgu" href="mailto:ankaraisilanlari@outlook.com?subject=${encodeURIComponent('Sahte ilan bildirimi')}" style="margin-top:1rem">Bildirin</a>
    </div>
  </div>
</section>
${isverenSerit()}
</main>
${dip()}`;
  yaz('guncel-ilanlar.html',govde);
}

/* ——— 3. KATEGORİ SAYFALARI ——— */
for (const [anahtar,k] of Object.entries(KATEGORI)) {
  const kendi = yazi.filter(y=>y.kategori===anahtar);
  const sss = kendi.flatMap(y=>y.sss||[]).slice(0,5);
  const ld=[{'@context':'https://schema.org','@type':'CollectionPage',name:k.ad,url:`${SITE}/${k.dosya}`,inLanguage:'tr-TR',
      about:{'@type':'Thing',name:k.anahtar},
      hasPart:kendi.map(y=>({'@type':'Article',headline:y.baslik,url:`${SITE}/${yaziYol(y)}`,datePublished:y.tarih}))},
    {'@context':'https://schema.org','@type':'FAQPage',inLanguage:'tr-TR',
      mainEntity:sss.map(q=>({'@type':'Question',name:q.s,acceptedAnswer:{'@type':'Answer',text:duz(q.c)}}))},
    yolIzi([{ad:'Ana Sayfa',yol:''},{ad:k.ad,yol:k.dosya}])];
  const govde=`${kafa(k.baslik,k.ozet,`${SITE}/${k.dosya}`,ld)}
<body>
${menu(anahtar)}
<main>
<section class="hero">
  <div class="kap">
    <p class="ustbaslik">${kac(k.ad)} · ${kendi.length} yazı</p>
    <h1 class="gorsel-baslik" style="max-width:18ch">${k.girisBaslik}</h1>
    <p class="giris" style="margin-top:1.4rem; max-width:74ch">${k.giris}</p>
  </div>
</section>

<section class="bolum">
  <div class="kap">
    <div class="bolum-bas"><h2 class="gorsel-baslik">Rehberler</h2><p>Bu bölüme düzenli olarak yeni yazı ekliyoruz.</p></div>
    <div class="izgara-3">
${kendi.map(y=>yaziKart(y)).join('\n')}
    </div>
  </div>
</section>
${sssBlok(sss)}
${isverenSerit()}
</main>
${dip()}`;
  yaz(k.dosya,govde);
}

/* ——— 4. MAKALELER ——— */
for (const y of yazi) {
  const k = KATEGORI[y.kategori];
  const digerleri = yazi.filter(x=>x.slug!==y.slug && x.kategori===y.kategori).slice(0,2);
  const ld=[{'@context':'https://schema.org','@type':'Article',headline:y.baslik,description:y.ozet,
      datePublished:y.tarih,dateModified:y.tarih,inLanguage:'tr-TR',
      author:{'@type':'Organization',name:'Ankara İş İlanları'},publisher:ORG,
      mainEntityOfPage:{'@type':'WebPage','@id':`${SITE}/${yaziYol(y)}`}},
    {'@context':'https://schema.org','@type':'FAQPage',inLanguage:'tr-TR',
      mainEntity:(y.sss||[]).map(q=>({'@type':'Question',name:q.s,acceptedAnswer:{'@type':'Answer',text:duz(q.c)}}))},
    yolIzi([{ad:'Ana Sayfa',yol:''},{ad:k.ad,yol:k.dosya},{ad:y.baslik,yol:yaziYol(y)}])];
  const govde=`${kafa(`${y.baslik} | Ankara İş İlanları`,y.ozet,`${SITE}/${yaziYol(y)}`,ld,'../')}
<body>
${menu(y.kategori,'../')}
<main>
<section class="hero">
  <div class="kap" style="max-width:820px">
    <p class="ustbaslik"><a href="../${k.dosya}" style="text-decoration:none">${kac(k.ad)}</a> · ${trTarih(y.tarih)} · ${y.okuma} dakikalık okuma</p>
    <h1 class="gorsel-baslik">${kac(y.baslik)}</h1>
    <p class="giris" style="margin-top:1.4rem">${kac(y.ozet)}</p>
  </div>
</section>

<section class="bolum">
  <div class="kap" style="max-width:820px">
${y.bolumler.map(b=>`    <h2 class="gorsel-baslik" style="font-size:clamp(1.5rem,2.4vw,2rem); margin-top:2.2rem">${kac(b.h)}</h2>
${b.p.map(p=>`    <p>${p}</p>`).join('\n')}`).join('\n')}
    <div class="uyari-blok" style="margin-top:2.5rem">
      <h3>Kısaca</h3>
      <ul class="liste-kontrol">
        <li><span class="im im-evet" aria-hidden="true">✓</span> Gerçek işveren, işe alacağı kişiden para istemez.</li>
        <li><span class="im im-evet" aria-hidden="true">✓</span> Çalışma yeri, saati ve ücreti işe başlamadan yazılı hale gelmeli.</li>
        <li><span class="im im-hayir" aria-hidden="true">✕</span> Kimlik ve IBAN bilgisi görüşme öncesi paylaşılmaz.</li>
      </ul>
      <a class="dugme dugme-vurgu" href="../guncel-ilanlar.html" style="margin-top:1.2rem">Güncel ilanlara bakın</a>
    </div>
  </div>
</section>
${sssBlok(y.sss,'../')}
${digerleri.length?`<section class="bolum bolum-hat">
  <div class="kap">
    <div class="bolum-bas"><h2 class="gorsel-baslik">Bu bölümdeki diğer yazılar</h2></div>
    <div class="izgara-2">
${digerleri.map(d=>yaziKart(d,'../')).join('\n')}
    </div>
  </div>
</section>`:''}
</main>
${dip('../')}`;
  yaz(yaziYol(y),govde);
}

/* ——— 5. İLAN SAYFALARI ——— */
for (const i of ilanlar) {
  const benzer = ilanlar.filter(x=>x.kod!==i.kod && (x.ilce===i.ilce||x.kategori===i.kategori)).slice(0,3);
  const ld=[{'@context':'https://schema.org','@type':'JobPosting',title:i.baslik,description:i.aciklama,
      datePosted:i.tarih,employmentType:i.calisma==='Tam zamanlı'?'FULL_TIME':'PART_TIME',
      hiringOrganization:{'@type':'Organization',name:'Ankara İş İlanları',sameAs:SITE},
      jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressLocality:i.ilce,addressRegion:'Ankara',addressCountry:'TR',streetAddress:i.semt}},
      directApply:false,inLanguage:'tr-TR',
      identifier:{'@type':'PropertyValue',name:'Ankara İş İlanları',value:i.kod}},
    yolIzi([{ad:'Ana Sayfa',yol:''},{ad:'Güncel İlanlar',yol:'guncel-ilanlar.html'},{ad:i.baslik,yol:ilanYol(i)}])];
  const govde=`${kafa(`${i.baslik} — ${i.ilce}, Ankara | ${i.calisma} İş İlanı`,
    `${i.ilce} ${i.semt} bölgesinde ${i.calisma.toLowerCase()} ${i.baslik.toLowerCase()} ilanı. ${i.sigorta?'Sigortalı çalışma. ':''}Aday para ödemez.`,
    `${SITE}/${ilanYol(i)}`, ld, '../')}
<body>
${menu('guncel','../')}
<main>
<section class="hero">
  <div class="kap">
    <p class="ustbaslik"><a href="../guncel-ilanlar.html" style="text-decoration:none">Güncel ilanlar</a> · ${kac(i.kod)} · ${trTarih(i.tarih)}</p>
    <h1 class="gorsel-baslik" style="max-width:20ch">${kac(i.baslik)}</h1>
    <p class="giris" style="margin-top:1.2rem; max-width:70ch">${kac(i.aciklama)}</p>
    <div style="display:flex; gap:.7rem; flex-wrap:wrap; margin-top:1.5rem">
      <a class="dugme dugme-vurgu" href="mailto:ankaraisilanlari@outlook.com?subject=${encodeURIComponent(i.kod+' – '+i.baslik)}">Bu ilana başvurun</a>
      <a class="dugme" href="../guncel-ilanlar.html">Diğer ilanlar</a>
    </div>
  </div>
</section>

<section class="bolum">
  <div class="kap izgara-2">
    <div class="kart">
      <h3>İlan bilgileri</h3>
      <ul class="alt-liste" style="margin-top:.6rem">
        <li><strong>Konum:</strong> ${kac(i.semt)}, ${kac(i.ilce)} / Ankara</li>
        <li><strong>Çalışma şekli:</strong> ${kac(i.calisma)}</li>
        <li><strong>Vardiya:</strong> ${kac(i.vardiya)}</li>
        <li><strong>Sigorta:</strong> ${i.sigorta?'İşveren tarafından yapılır':'İlanda belirtilmemiş'}</li>
        <li><strong>Tecrübe:</strong> ${i.tecrube?'Tecrübeli aday aranıyor':'Şart değil'}</li>
${i.ucret?`        <li><strong>Ücret:</strong> ${kac(i.ucret)}</li>`:''}
        <li><strong>İlan kodu:</strong> ${kac(i.kod)}</li>
      </ul>
    </div>
    <div class="uyari-blok">
      <h3>Başvuru güvenliği</h3>
      <p>Bu ilan ücret talebi kontrolünden geçti. İşe girmek için sizden kapora, kargo, üyelik ya da eğitim ücreti istenmez.</p>
      <ul class="liste-kontrol">
        <li><span class="im im-evet" aria-hidden="true">✓</span> Başvuru doğrudan işverene gider</li>
        <li><span class="im im-hayir" aria-hidden="true">✕</span> Para isteyen olursa başvurmayın, bize bildirin</li>
      </ul>
    </div>
  </div>
</section>
${benzer.length?`<section class="bolum bolum-hat">
  <div class="kap">
    <div class="bolum-bas"><h2 class="gorsel-baslik">Benzer ilanlar</h2></div>
    <div class="pano">
${benzer.map((b,n)=>satir(b,0.05+n*0.07,'../')).join('\n')}
    </div>
  </div>
</section>`:''}
</main>
${dip('../')}`;
  yaz(ilanYol(i),govde);
}

/* ——— 6. SITEMAP ——— */
const sayfalar=[
  ['',1.0,'daily'],['ek-is-ilanlari.html',0.9,'weekly'],['evde-paketleme-isi.html',0.9,'weekly'],['guncel-ilanlar.html',0.95,'daily'],
  ...yazi.map(y=>[yaziYol(y),0.8,'monthly']),
  ...ilanlar.map(i=>[ilanYol(i),0.7,'weekly'])];
yaz('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sayfalar.map(([s,p,f])=>`  <url><loc>${SITE}/${s}</loc><lastmod>${bugun}</lastmod><changefreq>${f}</changefreq><priority>${p}</priority></url>`).join('\n')}
</urlset>`);

console.log(`✓ üretildi: 1 ana sayfa · 1 ilan panosu (${ilanlar.length} ilan) · 2 kategori · ${yazi.length} yazı · ${ilanlar.length} ilan sayfası · sitemap (${sayfalar.length} adres)`);
