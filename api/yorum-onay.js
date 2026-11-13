// Yorum onay sayfası (13.11.2026). E-postadaki "Onayla / Reddet" bağlantısı BURAYA gelir. GET yalnız yorumu gösterir ve onay ister
// (e-posta tarayıcıları bağlantıyı kendiliğinden açabildiği için GET hiçbir şey değiştirmez); işlem POST ile yapılır.
// İmza: HMAC(kayıt no) — bilen yalnız e-postayı alan kişidir. Karar E-Tablodaki "Onay" hücresine EVET / HAYIR olarak yazılır.
const sheet = require('../lib/sheet.js');
const posta = require('../lib/posta.js');
const SEKME_OKU = "'Ankara İş İlanı Yorumları'!A2:H2000";
const kac = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sayfa = (baslik, govde) => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${kac(baslik)} | Ankara İş İlanı</title>
<style>body{margin:0;background:#F6F7FF;color:#14152E;font:16px/1.6 Arial,Helvetica,sans-serif;padding:24px 14px}main{max-width:620px;margin:0 auto;background:#fff;border:1px solid #E1E4F7;border-radius:18px;padding:26px}
h1{font-size:22px;line-height:1.3;margin:0 0 16px}.alt{color:#464862;font-size:14px;margin:0 0 4px}.kutu{background:#F6F7FF;border-left:4px solid #3B46F2;border-radius:8px;padding:14px 16px;white-space:pre-wrap;margin:0 0 20px}
button{font:600 16px Arial,sans-serif;border:0;border-radius:999px;padding:13px 24px;margin:0 8px 10px 0;cursor:pointer;color:#fff}.onay{background:#0B8A5F}.red{background:#C93A3A}.ok{background:#E5F6EE;border:2px solid #0B8A5F;border-radius:14px;padding:14px 16px}.hata{background:#FDECEC;border:2px solid #C93A3A;border-radius:14px;padding:14px 16px}a{color:#3B46F2}</style></head><body><main>${govde}</main></body></html>`;

async function bul(kayit) {
  const satirlar = await sheet.oku(SEKME_OKU);
  if (satirlar === null) return { hata: 'okuma' };
  const i = satirlar.findIndex(r => r[5] === kayit);
  if (i < 0) return { hata: 'yok' };
  const r = satirlar[i];
  return { satir: i + 2, slug: r[1], baslik: r[2], ad: r[3], yorum: r[4], durum: String(r[6] || '').trim().toUpperCase() };
}
const durumYazi = d => d === 'EVET' ? 'Yayında' : d === 'HAYIR' ? 'Reddedildi' : 'Onay bekliyor';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const q = req.query || {};
  const kayit = String(q.k || ''), imza = String(q.s || '');
  if (!/^YRM-[A-Z0-9-]{6,40}$/.test(kayit) || !posta.imzaGecerli(kayit, imza)) {
    return res.status(403).send(sayfa('Geçersiz bağlantı', '<h1>Bağlantı geçersiz</h1><p class="hata">Bu bağlantı eksik ya da değiştirilmiş. E-postadaki düğmeyi yeniden açın ya da kararı E-Tablodan verin.</p>'));
  }
  if (!sheet.yapilandirmaTamam()) return res.status(500).send(sayfa('Hata', '<h1>Ayar eksik</h1><p class="hata">Sunucu yapılandırması tamam değil.</p>'));
  const y = await bul(kayit);
  if (y.hata) return res.status(y.hata === 'yok' ? 404 : 502).send(sayfa('Hata', `<h1>${y.hata === 'yok' ? 'Yorum bulunamadı' : 'E-Tablo okunamadı'}</h1><p class="hata">${y.hata === 'yok' ? 'Bu kayıt E-Tabloda yok; silinmiş olabilir.' : 'Birkaç dakika sonra tekrar deneyin.'}</p>`));

  const baglar = `<p><a href="/yazi/${kac(y.slug)}">Makaleyi aç</a> · <a href="${kac(posta.tabloAdresi(y.satir))}">E-Tabloda aç</a></p>`;
  const ozet = `<p class="alt">Makale</p><p><strong>${kac(y.baslik)}</strong></p><p class="alt">Yazan</p><p><strong>${kac(y.ad)}</strong></p><p class="alt">Yorum</p><div class="kutu">${kac(y.yorum)}</div>`;

  if (req.method === 'POST') {
    let g = req.body;
    if (typeof g === 'string') g = Object.fromEntries(new URLSearchParams(g));
    const islem = String((g && g.islem) || '');
    if (islem !== 'onay' && islem !== 'red') return res.status(400).send(sayfa('Hata', '<h1>İşlem anlaşılamadı</h1>'));
    const deger = islem === 'onay' ? 'EVET' : 'HAYIR';
    const tamam = await sheet.guncelle(`'Ankara İş İlanı Yorumları'!G${y.satir}`, [deger]);
    if (!tamam) return res.status(502).send(sayfa('Hata', `<h1>İşlem yapılamadı</h1><p class="hata">E-Tabloya yazılamadı. Birkaç dakika sonra tekrar deneyin ya da kararı E-Tablodan verin.</p>${baglar}`));
    return res.status(200).send(sayfa('Karar kaydedildi', `<h1>${islem === 'onay' ? 'Yorum yayınlandı' : 'Yorum reddedildi'}</h1><p class="ok">${islem === 'onay' ? 'Yorum makalede en geç birkaç dakika içinde görünür.' : 'Yorum makalede yayınlanmayacak.'}</p>${ozet}${baglar}`));
  }
  if (req.method !== 'GET') return res.status(405).send(sayfa('Hata', '<h1>Desteklenmeyen istek</h1>'));
  const onSecim = q.i === 'red' ? 'red' : 'onay';
  return res.status(200).send(sayfa('Yorum onayı', `<h1>Yorum onayı</h1><p class="alt">Şu anki durum: <strong>${durumYazi(y.durum)}</strong></p>${ozet}
<form method="post" action="/api/yorum-onay?k=${encodeURIComponent(kayit)}&s=${encodeURIComponent(imza)}">
<button class="onay" type="submit" name="islem" value="onay"${onSecim === 'onay' ? ' autofocus' : ''}>Onayla ve yayınla</button><button class="red" type="submit" name="islem" value="red"${onSecim === 'red' ? ' autofocus' : ''}>Reddet</button></form>${baglar}`));
};
