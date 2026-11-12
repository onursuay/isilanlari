// Aday başvurusu: ilan sayfasındaki formu Owner'ın E-Tablosu'na ("Ankara İş İlanı Başvuruları" sekmesi) yazar (12.11.2026).
// E-posta kullanılmaz. Başvuru ekibe düşer, ekip işverene iletir (sayfada "başvurunuz bizim üzerimizden işverene iletilir" yazar).
// Güvenlik ve kayıt biçimi api/ilan.js ile aynı: kaynak kontrolü, alan doğrulama, gizli tuzak alanı, IP hız sınırı, RAW yazım.
const crypto = require('crypto');
const sheet = require('../lib/sheet.js');

const KAYNAK = /^https:\/\/(www\.)?ankaraisilani\.com(\/|$)/;
const SEKME = "'Ankara İş İlanı Başvuruları'!A:I";
const sinir = new Map(); // IP başına 10 dakikada en çok 8 başvuru

function hizAsildi(ip) {
  const simdi = Date.now();
  const taze = (sinir.get(ip) || []).filter(t => simdi - t < 600000);
  taze.push(simdi);
  sinir.set(ip, taze);
  if (sinir.size > 5000) sinir.clear();
  return taze.length > 8;
}
const metin = (v, en) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, en) : '');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const kaynak = req.headers.origin || req.headers.referer || '';
  if (!KAYNAK.test(kaynak)) return res.status(403).json({ ok: false });

  let g = req.body;
  if (typeof g === 'string') { try { g = JSON.parse(g); } catch (e) { return res.status(400).json({ ok: false }); } }
  if (!g || typeof g !== 'object') return res.status(400).json({ ok: false });
  if (g.web_sitesi) return res.status(200).json({ ok: true });            // tuzak alanı dolu: bot
  if (g.kvkk !== true) return res.status(400).json({ ok: false, neden: 'kvkk' });

  const ip = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim();
  if (hizAsildi(ip || 'bilinmiyor')) return res.status(429).json({ ok: false, neden: 'hiz' });

  const a = { kod: metin(g.ilan_kodu, 40), baslik: metin(g.ilan_baslik, 160), ad: metin(g.ad, 100), telefon: metin(g.telefon, 30),
    not: metin(g.not, 1000), kaynak: metin(g.kaynak, 300) };
  const kotu = [];
  if (!/^[A-Za-z0-9._-]{2,40}$/.test(a.kod)) kotu.push('ilan');
  if (!a.ad) kotu.push('ad');
  if (a.telefon.replace(/\D/g, '').length < 10) kotu.push('telefon');
  if (kotu.length) return res.status(400).json({ ok: false, neden: 'alan', alanlar: kotu });
  if (!sheet.yapilandirmaTamam()) return res.status(500).json({ ok: false, neden: 'yapilandirma' });

  const kayitNo = 'BSV-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
  const satir = [sheet.trZaman(), a.kod, a.baslik, a.ad, a.telefon, a.not, a.kaynak || 'doğrudan', kayitNo, ''];
  const tamam = await sheet.ekle(SEKME, satir);
  return tamam ? res.status(200).json({ ok: true, kayit: kayitNo }) : res.status(502).json({ ok: false, neden: 'kayit' });
};
