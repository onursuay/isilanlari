// İlan formu — Vercel sunucusuz işlev (12.11.2026).
// Sitedeki "İlan Ver" formunu Owner'ın Google E-Tablosu'na ("Ankara İş İlanı" sekmesi) satır olarak yazar.
// E-posta kullanılmaz (info@ adresi çalışmıyor). Kimlik bilgisi YALNIZ ortam değişkenlerinde (depo herkese açık):
//   GOOGLE_SA_EMAIL, GOOGLE_SA_KEY (servis hesabı), ILAN_SHEET_ID (e-tablo kimliği).
// Güvenlik: yalnız sitenin kendi kaynağından, POST, alan uzunluk sınırları, gizli tuzak alanı, IP başına hız sınırı.
// Değerler RAW yazılır: formül çalışmaz (=, +, - ile başlayan metin düz metin kalır), telefonun baştaki 0'ı korunur.
const crypto = require('crypto');

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

const b64u = s => Buffer.from(s).toString('base64url');
let onbellek = { jeton: null, bitis: 0 };

async function erisimJetonu() {
  const simdi = Math.floor(Date.now() / 1000);
  if (onbellek.jeton && onbellek.bitis - 120 > simdi) return onbellek.jeton;
  const anahtar = String(process.env.GOOGLE_SA_KEY || '').replace(/\\n/g, '\n');
  const bas = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const yuk = b64u(JSON.stringify({ iss: process.env.GOOGLE_SA_EMAIL, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', iat: simdi, exp: simdi + 3600 }));
  const imza = crypto.sign('RSA-SHA256', Buffer.from(`${bas}.${yuk}`), anahtar).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${bas}.${yuk}.${imza}` }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('jeton ' + r.status + ' ' + (j.error || ''));
  onbellek = { jeton: j.access_token, bitis: simdi + (j.expires_in || 3600) };
  return onbellek.jeton;
}

const metin = (v, en) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, en) : '');

function trZaman() {
  const t = new Date(Date.now() + 3 * 3600 * 1000);   // Türkiye UTC+3, yaz saati yok
  return t.toISOString().slice(0, 19) + '+03:00';
}

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

  if (!process.env.GOOGLE_SA_EMAIL || !process.env.GOOGLE_SA_KEY || !process.env.ILAN_SHEET_ID)
    return res.status(500).json({ ok: false, neden: 'yapilandirma' });

  const kayitNo = 'AII-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
  const satir = [trZaman(), a.firma, a.telefon, a.eposta, a.pozisyon, a.ilce, a.calisma, a.sigorta, a.ucret || 'Belirtilmedi',
    a.aciklama || '', a.kaynak || 'doğrudan', kayitNo, ''];

  const kes = new AbortController();
  const zaman = setTimeout(() => kes.abort(), 8000);
  try {
    const jeton = await erisimJetonu();
    const adres = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.ILAN_SHEET_ID}/values/${encodeURIComponent(SEKME)}:append`
      + '?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
    const r = await fetch(adres, { method: 'POST', signal: kes.signal,
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [satir] }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !(j.updates && j.updates.updatedRows === 1)) {
      console.error('Sheets hata', r.status, j.error && j.error.status);
      return res.status(502).json({ ok: false, neden: 'kayit' });
    }
    return res.status(200).json({ ok: true, kayit: kayitNo });
  } catch (e) {
    console.error('İlan kayıt istisna', e && (e.name + ' ' + String(e.message).slice(0, 80)));
    return res.status(504).json({ ok: false, neden: 'kayit' });
  } finally { clearTimeout(zaman); }
};
