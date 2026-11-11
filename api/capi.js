// Meta Conversions API (CAPI) — Vercel sunucusuz işlev.
// Yalnız ad_storage ONAYI VERİLMİŞ ziyaretçilerde, onaya bağlı GTM etiketlerinden çağrılır (onay yoksa etiket çalışmaz,
// bu işleve istek HİÇ gelmez). Tarayıcı pikseliyle AYNI event_id kullanılır; Meta iki kaydı tekilleştirir.
// Kişisel veri (e-posta, telefon, ad) bu işlevden ASLA geçmez; yalnız tarayıcı bilgisi, IP, _fbp/_fbc çerezleri.
const PIXEL = '1677617783940091';
const OLAYLAR = { PageView: null, Lead: 'ilan_verme_formu', Contact: 'ilan_basvurusu' };
const KAYNAK = /^https:\/\/(www\.)?ankaraisilani\.com(\/|$)/;
const sinir = new Map(); // örnek başına basit hız sınırı: IP başına dakikada 40 istek

function hizAsildi(ip) {
  const simdi = Date.now();
  const k = sinir.get(ip) || [];
  const taze = k.filter(t => simdi - t < 60000);
  taze.push(simdi);
  sinir.set(ip, taze);
  if (sinir.size > 2000) sinir.clear();
  return taze.length > 40;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const kaynak = req.headers.origin || req.headers.referer || '';
  if (!KAYNAK.test(kaynak)) return res.status(403).end();

  let g = req.body;
  if (typeof g === 'string') { try { g = JSON.parse(g); } catch (e) { return res.status(400).end(); } }
  if (!g || typeof g !== 'object') return res.status(400).end();
  if (g.onay !== 1) return res.status(403).end();                       // onay bayrağı yoksa gönderme
  if (!Object.prototype.hasOwnProperty.call(OLAYLAR, g.ad)) return res.status(400).end();
  if (typeof g.id !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(g.id)) return res.status(400).end();
  if (typeof g.url !== 'string' || g.url.length > 300 || !KAYNAK.test(g.url)) return res.status(400).end();
  const fbp = typeof g.fbp === 'string' && /^fb\.[0-9]\.[0-9]+\.[0-9]+$/.test(g.fbp) ? g.fbp : undefined;
  const fbc = typeof g.fbc === 'string' && /^fb\.[0-9]\.[0-9]+\.[A-Za-z0-9_-]{1,200}$/.test(g.fbc) ? g.fbc : undefined;

  const ip = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim();
  if (hizAsildi(ip || 'bilinmiyor')) return res.status(429).end();

  const jeton = process.env.META_CAPI_TOKEN;
  if (!jeton) return res.status(500).json({ ok: false, neden: 'yapilandirma' });

  const olay = {
    event_name: g.ad,
    event_time: Math.floor(Date.now() / 1000),
    event_id: g.id,
    event_source_url: g.url,
    action_source: 'website',
    user_data: { client_user_agent: req.headers['user-agent'] || undefined, client_ip_address: ip || undefined, fbp, fbc },
  };
  if (OLAYLAR[g.ad]) olay.custom_data = { content_name: OLAYLAR[g.ad] };
  const govde = { data: [olay] };
  if (process.env.META_CAPI_TEST_CODE) govde.test_event_code = process.env.META_CAPI_TEST_CODE;

  const kes = new AbortController();
  const zaman = setTimeout(() => kes.abort(), 4500);
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${PIXEL}/events?access_token=${encodeURIComponent(jeton)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde), signal: kes.signal,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { console.error('CAPI hata', r.status, j.error && j.error.code, j.error && j.error.error_subcode); return res.status(502).json({ ok: false }); }
    return res.status(200).json({ ok: true, alinan: j.events_received });
  } catch (e) {
    console.error('CAPI istisna', e && e.name);
    return res.status(504).json({ ok: false });
  } finally { clearTimeout(zaman); }
};
