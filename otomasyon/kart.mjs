// İlan kartı üretici: bir ilan kaydından 1080x1350 (4:5) JPEG üretir.
// Kullanım: node otomasyon/kart.mjs <ilan.json> <cikti.jpg>
// Palet logodan: grafit #14181D, altın #EDB91A, platin #AEB6BF. Kreatif üstü yazıda noktalama yok
// (alan adı ve ilan kodundaki tire hariç). Telefon, e-posta ve işveren adı kartta ASLA yer almaz.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const KOK = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [, , girdi, cikti] = process.argv;
if (!girdi || !cikti) { console.error('Kullanım: node otomasyon/kart.mjs <ilan.json> <cikti.jpg>'); process.exit(2); }
const i = JSON.parse(fs.readFileSync(girdi, 'utf8'));
const dosya = p => pathToFileURL(path.join(KOK, p)).href;
const kac = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// kreatif üstü yazıda noktalama olmaz: iki nokta, parantez, virgül ve nokta temizlenir (rakam içi nokta kalır)
const duz = s => String(s ?? '').replace(/[():;,!?]/g, ' ').replace(/(?<!\d)\.|\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim();

const yer = (i.semt && i.semt !== i.ilce) ? `${i.ilce} ${i.semt}` : i.ilce;
const ucret = (i.ucret || '').replace(/^İşveren beyanı:\s*/, '');
const imkan = [i.sigorta && 'Sigorta', i.yemek && 'Yemek', i.servis && 'Servis'].filter(Boolean);
const kutular = [
  ['Konum', yer],
  ['Çalışma', i.calisma + (i.vardiya ? ' ' + i.vardiya.toLowerCase() : '')],
  ...(ucret ? [['İşveren beyanı', ucret]] : []),
  ...(i.tecrube === false ? [['Tecrübe', 'Şart değil']] : i.tecrube === true ? [['Tecrübe', 'Tercih edilir']] : []),
];
const UR_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF';
const UR_LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
// Türkçe İ, ş, ğ latin-ext aralığındadır: iki dosya da yüklenir (bulutta sistem yazı tipi yok)
const font = (w) => ['latin-ext', 'latin'].map(k => `@font-face{font-family:'PoppinsKart';font-weight:${w};src:url(${dosya(`medya/yazi/poppins-${w}-${k}.woff2`)}) format('woff2');unicode-range:${k === 'latin' ? UR_LAT : UR_EXT}}`).join('');
const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>
${font(500)}${font(600)}${font(700)}
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1350px;background:#14181D;font-family:'PoppinsKart',sans-serif;color:#fff;position:relative;overflow:hidden}
.isik{position:absolute;right:-260px;top:-260px;width:820px;height:820px;border-radius:50%;background:radial-gradient(circle,rgba(237,185,26,.30),rgba(237,185,26,0) 68%)}
.cizgi{position:absolute;left:0;top:0;bottom:0;width:14px;background:linear-gradient(#EDB91A,#C88F00)}
.ic{position:relative;padding:84px 84px 0 96px;height:100%}
.ust{display:flex;align-items:center;gap:26px}
.ust img{width:116px;height:116px;border-radius:50%;background:#2D343C;box-shadow:0 0 0 5px rgba(237,185,26,.55)}
.ust b{font-size:38px;font-weight:700;letter-spacing:.01em}
.ust small{display:block;font-size:26px;font-weight:500;color:#AEB6BF}
.etiket{margin-top:64px;display:inline-block;background:#EDB91A;color:#14181D;font-weight:700;font-size:34px;padding:14px 30px;border-radius:10px}
h1{margin-top:34px;font-size:${(i.baslik||'').length > 26 ? 96 : 118}px;font-weight:700;line-height:1.04;letter-spacing:-.03em;max-width:880px}
.izgara{margin-top:48px;display:grid;grid-template-columns:1fr 1fr;gap:22px;max-width:888px}
.kutu{background:#1D2229;border:2px solid #2D343C;border-radius:14px;padding:22px 30px}
.kutu span{display:block;font-size:25px;font-weight:500;color:#AEB6BF}
.kutu strong{display:block;margin-top:6px;font-size:40px;font-weight:600;line-height:1.15}
.imkan{margin-top:30px;display:flex;gap:16px;flex-wrap:wrap}
.imkan i{font-style:normal;font-size:31px;font-weight:600;color:#14181D;background:#AEB6BF;padding:12px 26px;border-radius:10px}
.alt{position:absolute;left:0;right:0;bottom:0;height:176px;background:#EDB91A;color:#14181D;padding:0 84px 0 96px;display:flex;align-items:center;justify-content:space-between}
.alt b{font-size:44px;font-weight:700;letter-spacing:-.01em}
.alt span{font-size:27px;font-weight:600}
</style></head><body>
<div class="isik"></div><div class="cizgi"></div>
<div class="ic">
  <div class="ust"><img src="${dosya('medya/logo.png')}" alt=""><div><b>Ankara İş İlanı</b><small>Güncel ilan</small></div></div>
  <div class="etiket">Eleman aranıyor</div>
  <h1>${kac(duz(i.baslik))}</h1>
  <div class="izgara">${kutular.map(([e, d]) => `<div class="kutu"><span>${kac(duz(e))}</span><strong>${kac(duz(d))}</strong></div>`).join('')}</div>
  ${imkan.length ? `<div class="imkan">${imkan.map(x => `<i>${kac(x)}</i>`).join('')}</div>` : ''}
</div>
<div class="alt"><b>ankaraisilani.com</b><span>İlan kodu ${kac(i.kod)}</span></div>
</body></html>`;

let b;
try { b = await chromium.launch({ channel: 'chrome' }); } catch { b = await chromium.launch(); }
const sayfa = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
const gecici = path.join(KOK, 'otomasyon', `_kart_${process.pid}.html`);
fs.writeFileSync(gecici, html);
try {
  await sayfa.goto(pathToFileURL(gecici).href, { waitUntil: 'load' });
  await sayfa.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(g => g.decode().catch(() => {}))); });
  const logoTamam = await sayfa.evaluate(() => document.images[0].naturalWidth > 0);
  if (!logoTamam) { console.error('HATA: logo yüklenmedi'); process.exit(3); }

  await sayfa.screenshot({ path: cikti, type: 'jpeg', quality: 92 });
} finally {
  fs.rmSync(gecici, { force: true });
  await b.close();
}
console.log('kart yazıldı:', cikti, fs.statSync(cikti).size, 'bayt');
