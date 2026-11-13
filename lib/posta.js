// Yorum bildirimi e-postası (13.11.2026). Gönderen ve alıcı info@ankaraisilani.com; kutudan Owner'ın Hotmail'ine yönlendirme tanımlıdır.
// Ayarlar yalnız Vercel ortam değişkenlerinde: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, BILDIRIM_ALICI, YORUM_ONAY_SIR.
const crypto = require('crypto');
const SITE = 'https://ankaraisilani.com';
const YORUM_GID = '1834273107';
let gonderilen = []; // saatte en çok 20 bildirim (sel koruması)

const kac = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const imza = kayit => crypto.createHmac('sha256', process.env.YORUM_ONAY_SIR || '').update('yorum:' + kayit).digest('hex').slice(0, 32);
function imzaGecerli(kayit, gelen) {
  if (!process.env.YORUM_ONAY_SIR || typeof gelen !== 'string' || gelen.length !== 32) return false;
  const a = Buffer.from(imza(kayit)), b = Buffer.from(gelen);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const onayAdresi = (kayit, islem) => `${SITE}/api/yorum-onay?k=${encodeURIComponent(kayit)}&s=${imza(kayit)}${islem ? '&i=' + islem : ''}`;
const tabloAdresi = satir => `https://docs.google.com/spreadsheets/d/${process.env.ILAN_SHEET_ID}/edit?gid=${YORUM_GID}${satir ? '&range=G' + satir : ''}#gid=${YORUM_GID}`;
function yapilandirmaTamam() { return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.BILDIRIM_ALICI && process.env.YORUM_ONAY_SIR); }

function icerik(y) {
  const duzMetin = `Yeni yorum geldi (onay bekliyor)\n\nMakale: ${y.baslik}\n${SITE}/yazi/${y.slug}\n\nAd: ${y.ad}\n\n${y.yorum}\n\nOnayla: ${onayAdresi(y.kayit, 'onay')}\nReddet: ${onayAdresi(y.kayit, 'red')}\nE-Tabloda aç: ${tabloAdresi(y.satir)}\n\nKayıt: ${y.kayit}`;
  const dugme = (renk, metin, adres) => `<a href="${adres}" style="display:inline-block;padding:12px 22px;margin:0 8px 8px 0;border-radius:999px;background:${renk};color:${renk === '#FFB81C' ? '#14152E' : '#fff'};font:600 15px Arial,sans-serif;text-decoration:none">${metin}</a>`;
  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#F6F7FF;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#14152E">
<table role="presentation" width="100%" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #E1E4F7;border-radius:16px"><tr><td style="padding:24px">
<p style="margin:0 0 4px;font-size:13px;color:#464862">Ankara İş İlanı · yorum bildirimi</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">Yeni yorum onay bekliyor</h1>
<p style="margin:0 0 4px;font-size:14px;color:#464862">Makale</p>
<p style="margin:0 0 16px;font-size:15px"><a href="${SITE}/yazi/${kac(y.slug)}" style="color:#3B46F2">${kac(y.baslik)}</a></p>
<p style="margin:0 0 4px;font-size:14px;color:#464862">Yazan</p>
<p style="margin:0 0 16px;font-size:15px;font-weight:bold">${kac(y.ad)}</p>
<p style="margin:0 0 4px;font-size:14px;color:#464862">Yorum</p>
<div style="margin:0 0 20px;padding:14px 16px;background:#F6F7FF;border-left:4px solid #3B46F2;border-radius:8px;font-size:15px;line-height:1.6;white-space:pre-wrap">${kac(y.yorum)}</div>
<p style="margin:0 0 8px">${dugme('#0B8A5F', 'Onayla ve yayınla', onayAdresi(y.kayit, 'onay'))}${dugme('#C93A3A', 'Reddet', onayAdresi(y.kayit, 'red'))}</p>
<p style="margin:0 0 20px;font-size:13px;color:#464862">Düğmeler önce bir onay sayfası açar; işlem orada tek tıkla tamamlanır.</p>
<p style="margin:0;font-size:14px"><a href="${tabloAdresi(y.satir)}" style="color:#3B46F2">E-Tabloda aç</a> <span style="color:#464862">(Onay sütununa EVET yazarsanız da yayınlanır)</span></p>
</td></tr></table>
<p style="max-width:600px;margin:12px auto 0;font-size:12px;color:#464862;text-align:center">Kayıt no: ${kac(y.kayit)}</p></body></html>`;
  return { duzMetin, html };
}

async function bildir(y) {
  if (!yapilandirmaTamam()) { console.error('Bildirim atlandı: SMTP ayarı eksik'); return false; }
  const simdi = Date.now(); gonderilen = gonderilen.filter(t => simdi - t < 3600000);
  if (gonderilen.length >= 20) { console.error('Bildirim atlandı: saatlik sınır'); return false; }
  gonderilen.push(simdi);
  try {
    const nodemailer = require('nodemailer');
    const tasiyici = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 8000 });
    const { duzMetin, html } = icerik(y);
    const konu = ('Yeni yorum: ' + y.baslik).slice(0, 120);
    const bilgi = await Promise.race([
      tasiyici.sendMail({ from: `"Ankara İş İlanı" <${process.env.SMTP_USER}>`, to: process.env.BILDIRIM_ALICI, subject: konu, text: duzMetin, html }),
      new Promise((_, red) => setTimeout(() => red(new Error('zaman aşımı')), 9000))]);
    return !!(bilgi && bilgi.accepted && bilgi.accepted.length);
  } catch (e) {
    console.error('Bildirim gönderilemedi', e && (e.code || e.name) + ' ' + String(e.message).slice(0, 80));
    return false;
  }
}
module.exports = { bildir, imza, imzaGecerli, onayAdresi, tabloAdresi, yapilandirmaTamam, icerik };
