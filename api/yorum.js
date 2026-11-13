// Makale yorumları (13.11.2026). Yorum E-Tablo'daki "Ankara İş İlanı Yorumları" sekmesine yazılır; ekip "Onay" sütununa EVET
// yazarsa makale sayfasında görünür. GET: yalnız onaylı yorumları verir (e-posta/IP toplanmaz, hiçbir kişisel veri dönmez).
// POST: kaynak kontrolü, alan doğrulama, bağlantı yasağı, gizli tuzak, süre ve IP hız sınırı, RAW yazım (formül çalışmaz).
const crypto = require('crypto');
const sheet = require('../lib/sheet.js');
const BASLIKLAR = new Map(require('../veri/yazilar.json').yazilar.map(y => [y.slug, y.baslik]));

const KAYNAK = /^https:\/\/(www\.)?ankaraisilani\.com(\/|$)/;
const SEKME_YAZ = "'Ankara İş İlanı Yorumları'!A:H";
const SEKME_OKU = "'Ankara İş İlanı Yorumları'!A2:H2000";
const BAGLANTI = /(https?:|www\.|\b[a-z0-9-]{2,}\.(com|net|org|info|xyz|ru|co|io|me|biz|site|online|shop|top|tr)\b)/i;
const sinir = new Map(); // IP başına 10 dakikada en çok 3 yorum
const sonMetin = new Map();

function hizAsildi(ip) {
  const simdi = Date.now();
  const taze = (sinir.get(ip) || []).filter(t => simdi - t < 600000);
  taze.push(simdi);
  sinir.set(ip, taze);
  if (sinir.size > 5000) sinir.clear();
  return taze.length > 3;
}
const metin = (v, en) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, en) : '');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const slug = String((req.query && req.query.slug) || '');
    if (!BASLIKLAR.has(slug)) return res.status(400).json({ ok: false });
    if (!sheet.yapilandirmaTamam()) return res.status(500).json({ ok: false });
    const satirlar = await sheet.oku(SEKME_OKU);
    if (satirlar === null) { res.setHeader('Cache-Control', 'no-store'); return res.status(502).json({ ok: false }); }
    const yorumlar = satirlar
      .filter(r => r[1] === slug && String(r[6] || '').trim().toUpperCase() === 'EVET' && r[3] && r[4])
      .map(r => ({ ad: String(r[3]).slice(0, 40), yorum: String(r[4]).slice(0, 1000), tarih: String(r[0] || '').slice(0, 10), yanit: String(r[7] || '').slice(0, 1000) }))
      .reverse().slice(0, 50);
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ ok: true, yorumlar });
  }

  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const kaynak = req.headers.origin || req.headers.referer || '';
  if (!KAYNAK.test(kaynak)) return res.status(403).json({ ok: false });

  let g = req.body;
  if (typeof g === 'string') { try { g = JSON.parse(g); } catch (e) { return res.status(400).json({ ok: false }); } }
  if (!g || typeof g !== 'object') return res.status(400).json({ ok: false });
  if (g.web_sitesi) return res.status(200).json({ ok: true });                         // tuzak alanı dolu: bot
  if (Number(g.sure) < 4000) return res.status(200).json({ ok: true });                // 4 sn'den hızlı doldurulan form: bot
  if (g.kvkk !== true) return res.status(400).json({ ok: false, neden: 'kvkk' });

  const slug = String(g.slug || '');
  if (!BASLIKLAR.has(slug)) return res.status(400).json({ ok: false, neden: 'makale' });
  const a = { ad: metin(g.ad, 40), yorum: metin(g.yorum, 1000) };
  const kotu = [];
  if (a.ad.length < 2) kotu.push('ad');
  if (a.yorum.length < 10) kotu.push('yorum');
  if (BAGLANTI.test(a.ad) || BAGLANTI.test(a.yorum)) return res.status(400).json({ ok: false, neden: 'baglanti' });
  if (kotu.length) return res.status(400).json({ ok: false, neden: 'alan', alanlar: kotu });

  const ip = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim() || 'bilinmiyor';
  if (hizAsildi(ip)) return res.status(429).json({ ok: false, neden: 'hiz' });
  const imza = crypto.createHash('sha1').update(slug + '|' + a.yorum).digest('hex');
  if (sonMetin.get(imza) && Date.now() - sonMetin.get(imza) < 3600000) return res.status(200).json({ ok: true }); // aynı yorum tekrar
  sonMetin.set(imza, Date.now()); if (sonMetin.size > 2000) sonMetin.clear();
  if (!sheet.yapilandirmaTamam()) return res.status(500).json({ ok: false, neden: 'yapilandirma' });

  const kayitNo = 'YRM-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
  const tamam = await sheet.ekle(SEKME_YAZ, [sheet.trZaman(), slug, BASLIKLAR.get(slug), a.ad, a.yorum, kayitNo, '', '']);
  return tamam ? res.status(200).json({ ok: true, kayit: kayitNo }) : res.status(502).json({ ok: false, neden: 'kayit' });
};
