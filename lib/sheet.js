// Google E-Tablo yazıcısı (ilan formu ve başvuru formu ortak). Kimlik bilgisi yalnız Vercel ortam değişkenlerinde.
const crypto = require('crypto');
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


async function ekle(sekmeAraligi, satir) {
  const kes = new AbortController();
  const zaman = setTimeout(() => kes.abort(), 8000);
  try {
    const jeton = await erisimJetonu();
    const adres = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.ILAN_SHEET_ID}/values/${encodeURIComponent(sekmeAraligi)}:append`
      + '?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
    const r = await fetch(adres, { method: 'POST', signal: kes.signal,
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [satir] }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !(j.updates && j.updates.updatedRows === 1)) { console.error('Sheets hata', r.status, j.error && j.error.status); return false; }
    return true;
  } catch (e) {
    console.error('Sheets istisna', e && (e.name + ' ' + String(e.message).slice(0, 80)));
    return false;
  } finally { clearTimeout(zaman); }
}

async function oku(aralik) {
  const kes = new AbortController();
  const zaman = setTimeout(() => kes.abort(), 8000);
  try {
    const jeton = await erisimJetonu();
    const adres = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.ILAN_SHEET_ID}/values/${encodeURIComponent(aralik)}`;
    const r = await fetch(adres, { signal: kes.signal, headers: { Authorization: `Bearer ${jeton}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { console.error('Sheets okuma hata', r.status, j.error && j.error.status); return null; }
    return j.values || [];
  } catch (e) {
    console.error('Sheets okuma istisna', e && (e.name + ' ' + String(e.message).slice(0, 80)));
    return null;
  } finally { clearTimeout(zaman); }
}

function yapilandirmaTamam() { return !!(process.env.GOOGLE_SA_EMAIL && process.env.GOOGLE_SA_KEY && process.env.ILAN_SHEET_ID); }
function trZaman() { return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 19) + '+03:00'; }
module.exports = { ekle, oku, yapilandirmaTamam, trZaman };
