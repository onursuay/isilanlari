// İlan formu — Vercel sunucusuz işlev (12.11.2026).
// Sitedeki "İlan Ver" formunu Owner'ın Google E-Tablosu'na ("Ankara İş İlanı" sekmesi) satır olarak yazar.
// E-posta kullanılmaz (info@ adresi çalışmıyor). Kimlik bilgisi YALNIZ ortam değişkenlerinde (depo herkese açık):
//   GOOGLE_SA_EMAIL, GOOGLE_SA_KEY (servis hesabı), ILAN_SHEET_ID (e-tablo kimliği).
// Güvenlik: yalnız sitenin kendi kaynağından, POST, alan uzunluk sınırları, gizli tuzak alanı, IP başına hız sınırı.
// Değerler RAW yazılır: formül çalışmaz (=, +, - ile başlayan metin düz metin kalır), telefonun baştaki 0'ı korunur.
const crypto = require('crypto');
const sheet = require('../lib/sheet.js');

const KAYNAK = /^https:\/\/(www\.)?ankaraisilani\.com(\/|$)/;
const SEKME = "'Ankara İş İlanı'!A:M";
const ILCELER = ['Akyurt', 'Altındağ', 'Ayaş', 'Bala', 'Beypazarı', 'Çamlıdere', 'Çankaya', 'Çubuk', 'Elmadağ', 'Etimesgut', 'Evren',
  'Gölbaşı', 'Güdül', 'Haymana', 'Kahramankazan', 'Kalecik', 'Keçiören', 'Kızılcahamam', 'Mamak', 'Nallıhan', 'Polatlı', 'Pursaklar',
  'Sincan', 'Şereflikoçhisar', 'Yenimahalle'];
const CALISMA = ['Tam zamanlı', 'Yarı zamanlı', 'Vardiyalı'];
const SIGORTA = ['Var', 'Yok'];
const sinir = new Map(); // IP başına 10 dakikada en çok 6 gönderim

function hizAsildi(ip) {
  const simdi = Date.now();
  const taze = (sinir.get(ip) || []).filter(t => simdi - t < 600000);
  taze.push(simdi);
  sinir.set(ip, taze);
  if (sinir.size > 5000) sinir.clear();
  return taze.length > 6;
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
  if (g.web_sitesi) return res.status(200).json({ ok: true });            // tuzak alanı dolu: bot; sessizce kabul edilmiş gibi
  if (g.kvkk !== true) return res.status(400).json({ ok: false, neden: 'kvkk' });

  const ip = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim();
  if (hizAsildi(ip || 'bilinmiyor')) return res.status(429).json({ ok: false, neden: 'hiz' });

  const a = {
    firma: metin(g.firma, 120), telefon: metin(g.telefon, 30), eposta: metin(g.eposta, 120), pozisyon: metin(g.pozisyon, 120),
    ilce: metin(g.ilce, 40), calisma: metin(g.calisma, 20), sigorta: metin(g.sigorta, 10), ucret: metin(g.ucret, 60),
    aciklama: metin(g.aciklama, 2000), kaynak: metin(g.kaynak, 300),
  };
  const kotu = [];
  if (!a.firma) kotu.push('firma');
  if (a.telefon.replace(/\D/g, '').length < 10) kotu.push('telefon');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.eposta)) kotu.push('eposta');
  if (!a.pozisyon) kotu.push('pozisyon');
  if (!ILCELER.includes(a.ilce)) kotu.push('ilce');
  if (!CALISMA.includes(a.calisma)) kotu.push('calisma');
  if (!SIGORTA.includes(a.sigorta)) kotu.push('sigorta');
  if (kotu.length) return res.status(400).json({ ok: false, neden: 'alan', alanlar: kotu });

  if (!sheet.yapilandirmaTamam())
    return res.status(500).json({ ok: false, neden: 'yapilandirma' });

  const kayitNo = 'AII-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
  const satir = [sheet.trZaman(), a.firma, a.telefon, a.eposta, a.pozisyon, a.ilce, a.calisma, a.sigorta, a.ucret || 'Belirtilmedi',
    a.aciklama || '', a.kaynak || 'doğrudan', kayitNo, ''];

  const tamam = await sheet.ekle(SEKME, satir);
  return tamam ? res.status(200).json({ ok: true, kayit: kayitNo }) : res.status(502).json({ ok: false, neden: 'kayit' });
};
