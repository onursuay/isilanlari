#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ankara İş İlanı — site "İlan Ver" formu kaynağı (13.11.2026).

Form gönderimleri /api/ilan ile Owner'ın E-Tablosu'na ("Ankara İş İlanı" sekmesi) yazılır. Bu modül
o sekmedeki yeni satırları okur ve gelen kutusu ilanlarıyla AYNI kurallardan geçirir:
- aday para ödemez: suzgec.RED kalıplarından biri geçen ilan reddedilir;
- ayrımcı ifade (cinsiyet, yaş vb.) başlığa girmez, açıklama ham metinden değil şablondan kurulur;
- firma adı, telefon ve e-posta hiçbir yayına girmez;
- emin olunamayan (birden fazla pozisyon, okunamayan pozisyon) "beklet"e düşer.

Sonuç E-Tablo'daki "Durum" sütununa (M) yazılır; ekip bu sütunu dolu gördüğü satıra hat dokunmaz.
Kimlik bilgisi yalnız ortam değişkenlerinde: GOOGLE_SA_EMAIL, GOOGLE_SA_KEY, ILAN_SHEET_ID.
Depoya (herkese açık) yalnız kayıt numarası, karar ve gerekçe yazılır.
"""
import base64, json, os, re, subprocess, tempfile, time, urllib.parse, urllib.request

import suzgec

SEKME = "Ankara İş İlanı"
# sütunlar: 0 Tarih · 1 Firma · 2 Telefon · 3 E-posta · 4 Pozisyon · 5 İlçe · 6 Çalışma · 7 Sigorta · 8 Ücret ·
#           9 İş Tanımı · 10 Kaynak · 11 Kayıt No · 12 Durum
_jeton = {"deger": None, "bitis": 0}


def yapilandirildi():
    return all(os.environ.get(k) for k in ("GOOGLE_SA_EMAIL", "GOOGLE_SA_KEY", "ILAN_SHEET_ID"))


def _b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _erisim():
    simdi = int(time.time())
    if _jeton["deger"] and _jeton["bitis"] - 120 > simdi:
        return _jeton["deger"]
    bas = _b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    yuk = _b64(json.dumps({"iss": os.environ["GOOGLE_SA_EMAIL"], "scope": "https://www.googleapis.com/auth/spreadsheets",
                           "aud": "https://oauth2.googleapis.com/token", "iat": simdi, "exp": simdi + 3600}).encode())
    fd, yol = tempfile.mkstemp(suffix=".pem")  # 0600
    try:
        with os.fdopen(fd, "w") as f:
            f.write(os.environ["GOOGLE_SA_KEY"].replace("\\n", "\n"))
        imza = subprocess.run(["openssl", "dgst", "-sha256", "-sign", yol], input=f"{bas}.{yuk}".encode(),
                              capture_output=True, check=True).stdout
    finally:
        os.remove(yol)
    govde = urllib.parse.urlencode({"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                                    "assertion": f"{bas}.{yuk}.{_b64(imza)}"}).encode()
    r = json.load(urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", govde), timeout=20))
    _jeton.update(deger=r["access_token"], bitis=simdi + int(r.get("expires_in", 3600)))
    return _jeton["deger"]


def _sheets(yol, govde=None, yontem="GET"):
    adres = f"https://sheets.googleapis.com/v4/spreadsheets/{os.environ['ILAN_SHEET_ID']}/{yol}"
    istek = urllib.request.Request(adres, json.dumps(govde).encode() if govde is not None else None, method=yontem,
                                   headers={"Authorization": "Bearer " + _erisim(), "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(istek, timeout=30))


def satirlar():
    """(satır_no, hücreler) listesi; satır_no E-Tablo'daki gerçek satır (başlık 1. satır)."""
    r = _sheets("values/" + urllib.parse.quote(f"'{SEKME}'!A2:M2000"))
    sonuc = []
    for i, s in enumerate(r.get("values", []), start=2):
        s = list(s) + [""] * (13 - len(s))
        sonuc.append((i, s))
    return sonuc


def durum_yaz(satir_no, metin):
    """Durum hücresine yazar ve geri okur; ekip hücreyi bu arada doldurduysa ÜZERİNE YAZMAZ."""
    hucre = urllib.parse.quote(f"'{SEKME}'!M{satir_no}")
    mevcut = _sheets(f"values/{hucre}").get("values", [[""]])[0]
    if mevcut and mevcut[0].strip():
        return False
    _sheets(f"values/{hucre}?valueInputOption=RAW", {"values": [[metin]]}, "PUT")
    return _sheets(f"values/{hucre}").get("values", [[""]])[0][0] == metin


def _basliga_cevir(metin):
    m = suzgec.kucuk(suzgec.temizle(metin))
    return (m[:1].replace("i", "İ").upper() + m[1:]) if m else ""


def degerlendir(s):
    """Form satırını gelen kutusu kararıyla aynı biçimde döndürür."""
    firma, pozisyon, ilce, calisma, sigorta, ucret, tanim = s[1], s[4], s[5], s[6], s[7], s[8], s[9]
    ham = suzgec.temizle(" ".join([pozisyon, ucret, tanim]))
    d = suzgec.kucuk(ham)
    sonuc = {"karar": "reddet", "gerekce": "", "ilan": None, "iz": suzgec.parmak_izi(" ".join([pozisyon, ilce, tanim]))}
    for kalip, gerekce in suzgec.RED:
        if re.search(kalip, suzgec.kucuk(firma) + " " + d):
            sonuc["gerekce"] = gerekce
            return sonuc
    # — başlık: önce sözlük (cinsiyetsiz standart ad), yoksa ayrımcı ifadesi ayıklanmış form metni —
    p = suzgec.kucuk(suzgec.temizle(pozisyon))
    bulunan, kapali = [], []
    for kalip, ad, kat in suzgec.MEVKILER:   # suzgec ile aynı: daha özgül kalıbın aldığı yer yeniden sayılmaz
        for m in re.finditer(kalip, p):
            if any(m.start() < y and x < m.end() for x, y in kapali):
                continue
            kapali.append((m.start(), m.end()))
            if (ad, kat) not in bulunan:
                bulunan.append((ad, kat))
    if len(bulunan) > 1:
        sonuc.update(karar="beklet", gerekce="pozisyon alanında birden fazla pozisyon: " + ", ".join(a for a, _ in bulunan))
        return sonuc
    if bulunan:
        baslik, kategori = bulunan[0]
    else:
        temiz = re.sub(r"\s{2,}", " ", suzgec.AYRIMCI.sub(" ", p)).strip(" -,/.")
        if not (2 <= len(temiz) <= 50) or re.search(r"\d|@|https?:|www\.", temiz):
            sonuc.update(karar="beklet", gerekce="pozisyon okunamadı, ekip kontrol etmeli")
            return sonuc
        baslik, kategori = _basliga_cevir(temiz), "diger"
    if ilce not in suzgec.ILCELER and ilce not in ("Altındağ", "Ayaş", "Bala", "Çamlıdere", "Evren", "Güdül", "Haymana",
                                                    "Kalecik", "Kızılcahamam", "Nallıhan", "Şereflikoçhisar"):
        sonuc.update(karar="beklet", gerekce="ilçe tanınmadı")
        return sonuc
    t = suzgec.kucuk(tanim)
    ilan = {
        "baslik": baslik, "ilce": ilce, "semt": ilce,
        "calisma": "Part time" if calisma == "Yarı zamanlı" else "Tam zamanlı",
        "vardiya": "Vardiyalı" if calisma == "Vardiyalı" or "vardiya" in t else "",
        "kategori": kategori,
        "sigorta": sigorta == "Var",
        "yemek": bool(re.search(r"yemek", t)),
        "servis": bool(re.search(r"servis", t)),
        "tecrube": (False if re.search(r"tecrübe (şart )?değil|tecrübesiz|deneyim (şart )?değil|yetiştirilmek", t)
                    else True if re.search(r"tecrübeli|deneyimli|tecrübe (şart|aranır|gerekli)", t) else None),
        "ucret": suzgec.ucret_bul("ücret " + suzgec.kucuk(ucret)) if ucret and ucret != "Belirtilmedi" else "",
    }
    ayrimci = len(suzgec.AYRIMCI.findall(p + " " + t))
    sonuc.update(karar="yayinla", ilan=ilan,
                 gerekce="süzgeçten geçti" + (f"; {ayrimci} ayrımcı ifade metne alınmadı" if ayrimci else ""))
    return sonuc


def yeni_kararlar(durum):
    """Durum sütunu boş ve daha önce işlenmemiş form satırları için kararlar."""
    islenen = durum.setdefault("form_islenen", {})
    gorulen = {v.get("iz") for v in list(durum.get("islenen", {}).values()) + list(islenen.values()) if v.get("iz")}
    kararlar = []
    for satir_no, s in satirlar():
        kayit = s[11].strip()
        if not kayit.startswith("AII-") or s[12].strip() or kayit in islenen:
            continue
        k = degerlendir(s)
        if k["karar"] == "yayinla" and k["iz"] in gorulen:
            k.update(karar="reddet", gerekce="aynı ilan daha önce işlendi (mükerrer)")
        gorulen.add(k["iz"])
        kararlar.append({"id": kayit, "platform": "site-formu", "konusma": "", "zaman": s[0], "satir": satir_no,
                         "karar": k["karar"], "gerekce": k["gerekce"], "iz": k["iz"], "ilan": k["ilan"]})
    return kararlar
