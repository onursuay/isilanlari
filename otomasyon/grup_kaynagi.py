#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ankara İş İlanı — Facebook grubu kaynağı (27.11.2026).

Facebook Grup API'si 2024'te kalktı. Grubun bekleyen ve "olası spam" gönderileri Owner'ın Mac'indeki köprü
Chrome'dan okunur (Agency Wizard deposu: _automation/ilan_hatti_grup/grup_tara.cjs; oturum VPS'e taşınmaz)
ve E-Tablo'nun "Facebook Grubu" sekmesine yazılır. Bu modül o sekmeyi okur; gönderiler Messenger mesajlarıyla
AYNI süzgeçten geçer. Karar "Durum" sütununa (H) yazılır; Mac taraması "yayınlandı" satırları grupta onaylar.

Sütunlar: A Kimlik · B Klasör · C Tarih (ISO) · D Yazar · E Metin · F Görsel · G İlk görülme · H Durum · I Grup işlemi
K1: Mac taramasının kalp atışı.
Depoya (herkese açık) yalnız kimlik, karar ve gerekçe yazılır; yazar adı ve metin yazılmaz.
"""
import urllib.parse
from datetime import datetime, timedelta, timezone

import form_kaynagi

SEKME = "Facebook Grubu"
ESKIME_GUN = 30          # bundan eski grup gönderisi yayınlanmaz (iş büyük olasılıkla dolmuştur)
KALP_SAAT = 30           # Mac taraması bundan uzun süredir çalışmadıysa uyarı
TR = timezone(timedelta(hours=3))


def yapilandirildi():
    return form_kaynagi.yapilandirildi()


def _aralik(a1):
    return "values/" + urllib.parse.quote(f"'{SEKME}'!{a1}")


def satirlar():
    r = form_kaynagi._sheets(_aralik("A2:I3000"))  # sekmeyi Mac taraması açar (27.11.2026'da açıldı)
    return [(i, list(s) + [""] * (9 - len(s))) for i, s in enumerate(r.get("values", []), start=2)]


def kalp_atisi():
    """(saat cinsinden yaş, metin) — K1 boşsa (None, '')."""
    v = form_kaynagi._sheets(_aralik("K1")).get("values", [[""]])[0][0]
    try:
        t = datetime.fromisoformat(v.split(" | ")[0])
        return (datetime.now(TR) - t).total_seconds() / 3600, v
    except ValueError:
        return None, v


def durum_yaz(satir_no, metin):
    """H hücresine yazar ve geri okur; dolu hücrenin üzerine yazmaz (ekip elle karar yazmış olabilir)."""
    hucre = _aralik(f"H{satir_no}")
    mevcut = form_kaynagi._sheets(hucre).get("values", [[""]])[0]
    if mevcut and mevcut[0].strip():
        return False
    form_kaynagi._sheets(hucre + "?valueInputOption=RAW", {"values": [[metin]]}, "PUT")
    return form_kaynagi._sheets(hucre).get("values", [[""]])[0][0] == metin


def yeni_mesajlar(islenen):
    """Durum sütunu boş, daha önce işlenmemiş grup gönderileri (toplayıcının mesaj biçiminde).
    'on_karar' dolu olan gönderi süzgece girmeden o kararı alır (eski / erişilemeyen gönderi)."""
    simdi = datetime.now(TR)
    sonuc = []
    for satir_no, s in satirlar():
        kimlik, klasor, tarih, _yazar, metin, gorsel, _ilk, durum, _ = s
        if not kimlik.startswith("G-") or durum.strip() or kimlik in islenen:
            continue
        on_karar = None
        try:
            yas = (simdi - datetime.fromisoformat(tarih)).days
        except ValueError:
            yas = None
        if metin.startswith("(gönderiye erişilemiyor)"):
            on_karar = ("reddet", "grup gönderisine erişilemiyor (sahibi kısıtlamış ya da silmiş)")
        elif yas is not None and yas > ESKIME_GUN:
            on_karar = ("reddet", f"grup gönderisi {yas} günlük; {ESKIME_GUN} günden eski ilan yayınlanmaz")
        sonuc.append({"id": kimlik, "platform": "facebook-grubu", "konusma": klasor, "zaman": tarih or simdi.isoformat(),
                      "metin": "" if on_karar else metin, "ekler": ["image/jpeg"] * int(gorsel or 0),
                      "satir": satir_no, "on_karar": on_karar})
    return sonuc
