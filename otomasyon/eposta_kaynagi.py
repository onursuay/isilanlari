#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ankara İş İlanı — e-posta ile gelen ilanlar (26.11.2026, Owner: "e-posta ile gelen ilanları da bağlayacaksın").

info@ankaraisilani.com kutusunu SALT OKUNUR okur (EXAMINE; işaret, taşıma, silme YOK). Gelen Kutusu ile birlikte
"Deleted Items" da okunur: kutu webmail'den elle temizleniyor (26.11'de 19 ileti oradaydı), ilan okunup silinse
bile kaçmasın. Kendi alan adımızdan ve otomatik göndericilerden (DMARC raporu, noreply, mailer-daemon) gelenler
atlanır. Metin aynı süzgeçten geçer; spam ilan ifadesi taşımadığı için "reddet"e düşer, yalnız ek (görsel/PDF)
gönderilmişse "beklet" olur ve yayın denetçisi bildirir.

Ortam: ILAN_IMAP_SUNUCU, ILAN_IMAP_ADRES, ILAN_IMAP_PAROLA (yoksa kaynak atlanır ve günlüğe yazılır).
Gizlilik: depo herkese açık; durum dosyasına yalnız ileti kimliğinin özeti yazılır, adres ya da metin yazılmaz.
"""
import email, hashlib, imaplib, os, re
from datetime import timezone
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime

KLASORLER = ("INBOX", '"Deleted Items"')
AZAMI_GOVDE = 50_000          # karakter; ilan metni bunun çok altındadır
AZAMI_ILETI = 15 * 1024 * 1024  # bayt; daha büyük ileti indirilmeden atlanır
KENDI_ALAN = "ankaraisilani.com"
# yalnız adresin kullanıcı kısmına bakılır: işverenler Gmail/Hotmail/Outlook kullanır, alan adıyla süzülmez
OTOMATIK = re.compile(r"^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounces?|dmarc\w*|notifications?)([+._-].*)?$", re.I)


def yapilandirildi():
    return all(os.environ.get(k) for k in ("ILAN_IMAP_SUNUCU", "ILAN_IMAP_ADRES", "ILAN_IMAP_PAROLA"))


def _baslik(h):
    try:
        return str(make_header(decode_header(h or "")))
    except Exception:
        return h or ""


def _govde(msg):
    """Düz metin; yoksa HTML'den etiketleri ayıklanmış metin. Ekler ayrı listelenir."""
    duz, html, ekler = [], [], []
    for p in msg.walk():
        if p.is_multipart():
            continue
        tur = p.get_content_type()
        dosya = p.get_filename()
        yer = (p.get("Content-Disposition") or "").lower()
        if dosya or "attachment" in yer or tur.startswith(("image/", "application/")):
            ekler.append(tur)
            continue
        try:
            metin = p.get_payload(decode=True).decode(p.get_content_charset() or "utf-8", "replace")
        except Exception:
            continue
        (duz if tur == "text/plain" else html if tur == "text/html" else []).append(metin)
    # dışarıdan gelen içerik: düzenli ifadelerden önce boyut sınırlanır (ReDoS / bellek koruması)
    if duz:
        govde = "\n".join(duz)[:AZAMI_GOVDE]
    else:
        govde = "\n".join(html)[:AZAMI_GOVDE * 2]
        govde = re.sub(r"<(script|style)\b[^>]{0,500}>[\s\S]{0,20000}?</\1\s*>", " ", govde, flags=re.I)
        govde = re.sub(r"<br\s{0,5}/?>|</p>|</div>", "\n", govde, flags=re.I)
        govde = re.sub(r"<[^<>]{0,2000}>", " ", govde)
        govde = govde.replace("&nbsp;", " ")[:AZAMI_GOVDE]
    # alıntılanmış eski yazışma ve imza altı ilanı bozmasın: satır satır kesilir (regex geri izleme yok)
    satirlar = []
    for satir in govde.split("\n"):
        t = satir.strip()
        if t == "--" or (t.startswith("On ") and t.endswith("wrote:")) or (" tarihinde " in t and t.endswith("yazdı:")):
            break
        satirlar.append(satir)
    return "\n".join(satirlar).strip(), ekler


def yeni_epostalar(baslangic):
    """baslangic'tan (datetime, tz'li) sonra gelen dış e-postalar: [{id, platform, konusma, zaman, metin, ekler}]."""
    if not yapilandirildi():
        if os.environ.get("ILAN_EPOSTA_ZORUNLU") == "1":
            raise RuntimeError("e-posta kimliği yok (ILAN_IMAP_*)")  # sunucu: sessiz atlama yok
        print("  ! e-posta kaynağı yapılandırılmamış (ILAN_IMAP_*), atlandı")
        return []
    sonuc, gorulen = [], set()
    tarih = baslangic.astimezone(timezone.utc).strftime("%d-%b-%Y")
    try:
        M = imaplib.IMAP4_SSL(os.environ["ILAN_IMAP_SUNUCU"], 993, timeout=60)
        M.login(os.environ["ILAN_IMAP_ADRES"], os.environ["ILAN_IMAP_PAROLA"])
    except Exception as e:
        raise RuntimeError(f"e-posta kutusuna girilemedi: {type(e).__name__}") from None
    try:
        for kl in KLASORLER:
            if M.select(kl, readonly=True)[0] != "OK":
                continue
            _, ids = M.search(None, "SINCE", tarih)
            for i in ids[0].split():
                try:
                    kayit = _ileti_isle(M, i, baslangic, gorulen)
                except Exception as e:  # bozuk/kötü niyetli tek ileti bütün hattı durdurmaz
                    print(f"  ! e-posta {i.decode(errors='replace')} atlandı ({type(e).__name__})")
                    continue
                if kayit:
                    sonuc.append(kayit)
    except RuntimeError:
        raise
    except Exception as e:  # kutu/ağ düzeyindeki beklenmedik hata da öteki kaynakları durdurmaz
        raise RuntimeError(f"e-posta kutusu okunamadı: {type(e).__name__}") from None
    finally:
        try:
            M.logout()
        except Exception:
            pass
    return sonuc


def _ileti_isle(M, i, baslangic, gorulen):
    """Tek iletiyi okur; atlanacaksa None döner. Başlıklar str()'e çevrilerek kullanılır (bozuk başlık koruması)."""
    _, boy = M.fetch(i, "(RFC822.SIZE)")
    m = re.search(rb"RFC822\.SIZE (\d+)", boy[0] if isinstance(boy[0], bytes) else b"")
    if m and int(m.group(1)) > AZAMI_ILETI:
        print(f"  ! e-posta {i.decode(errors='replace')} çok büyük, atlandı")
        return None
    _, d = M.fetch(i, "(BODY.PEEK[])")
    msg = email.message_from_bytes(d[0][1])
    gonderen = email.utils.parseaddr(str(msg.get("From") or ""))[1].lower()
    if not gonderen or gonderen.endswith("@" + KENDI_ALAN) or OTOMATIK.match(gonderen.split("@")[0]):
        return None
    try:
        an = parsedate_to_datetime(str(msg.get("Date") or ""))
    except Exception:
        return None
    if an.tzinfo is None:
        an = an.replace(tzinfo=timezone.utc)
    if an <= baslangic:
        return None
    mid = str(msg.get("Message-ID") or f"{gonderen}|{msg.get('Date')}").strip()[:1000]
    kid = "eposta_" + hashlib.sha1(mid.encode("utf-8", "replace")).hexdigest()[:20]
    if kid in gorulen:
        return None  # aynı ileti iki klasörde
    gorulen.add(kid)
    govde, ekler = _govde(msg)
    konu = _baslik(str(msg.get("Subject") or ""))[:300]
    return {"id": kid, "platform": "eposta", "konusma": "eposta",
            "zaman": an.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+0000"),
            "metin": (konu + "\n" + govde).strip(), "ekler": ekler}
