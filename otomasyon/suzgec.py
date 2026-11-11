#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ankara İş İlanı — ilan süzgeci ve ayıklayıcı (saf işlev, ağ erişimi YOK).

Girdi: işverenin sayfaya yazdığı serbest metin.
Çıktı: karar = "yayinla" | "beklet" | "reddet", gerekçe ve yapılandırılmış ilan.

Siteye söz verilenler burada uygulanır (hakkimizda sayfası):
- Aday para ödemez: para isteyen ilan reddedilir.
- Cinsiyet ve yaş şartı gibi ayrımcı ifadeler çıkarılır: yayın metni ham metinden KOPYALANMAZ,
  ayıklanan alanlardan şablonla yeniden kurulur.
- Telefon numaraları sitede yer almaz: telefon/e-posta/bağlantı hiçbir çıktıya girmez.
Emin olunamayan her şey "beklet"e düşer; sistem tahminle yayın yapmaz.
"""
import hashlib, re, unicodedata

# ——— reddedilecek kalıplar (aday para öder / dolandırıcılık / yasak kategori) ———
RED = [
    (r"kapora|depozito|teminat", "kapora veya teminat isteniyor"),
    (r"kargo (ücret|bedel|parası)|kargo ücreti", "kargo ücreti isteniyor"),
    (r"üyelik (ücret|bedel)|kayıt (ücret|bedel|parası)|başvuru (ücret|bedel)", "üyelik veya kayıt ücreti isteniyor"),
    (r"eğitim (ücret|bedel)|kurs (ücret|bedel)", "eğitim ücreti isteniyor"),
    (r"sigorta (ücret|bedel)i? ?(yatır|öde)", "sigorta bedeli isteniyor"),
    (r"\biban\b|hesap numaram|para (yatır|gönder)|havale|eft ", "para transferi isteniyor"),
    (r"kimlik (fotokopi|foto|önyüz|numara)|tc ?kimlik|banka (bilgi|kart)", "kimlik veya banka bilgisi isteniyor"),
    (r"evde paketleme|evde iş verilir|eve iş|ev hanımlarına özel|evden (çalış|kazan)", "evde paketleme veya evden kazanç vaadi"),
    (r"sermayesiz|yüksek kazanç|günlük \d+ ?(bin|tl)|haftalık \d+ ?(bin|tl) kazan|pasif gelir|network|çoklu satış|bayilik|franchise|yatırım yap", "gerçek dışı kazanç vaadi veya sermaye isteyen model"),
    (r"bahis|casino|kripto|forex|şans oyunu|medyum|fal ", "yasak kategori"),
    (r"alkol|tütün|sigara satış|e-sigara|ilaç satış", "yasak kategori"),
]

ILAN_NIYETI = re.compile(r"aran(ıyor|maktadır|makta|ır)|alınacak|alınacaktır|alacağız|personel|eleman|çalışma arkadaş|iş ilan|ihtiyaç|kadro|görevli|usta|başvur|maaş|ücret|vardiya", re.I)

# ——— ayrımcı ifadeler: ham metinden çıkarılır, yayına GİRMEZ (yalnız sayılır) ———
AYRIMCI = re.compile(r"\b(bay|bayan|erkek|kad[ıi]n|hanım|bey|genç|yaş)\b|\d{2}\s*[-–]\s*\d{2}\s*yaş|askerliğini|evli|bekar|bekâr|sigara kullanmayan|boy\s*\d", re.I)

# ——— mevki sözlüğü: (kalıp, yayında görünecek ad, kategori) — cinsiyet içermez ———
MEVKILER = [
    (r"temizlik (görevli|personel|eleman|çalışan)\w*", "Temizlik görevlisi", "temizlik"),
    (r"temizlikçi\w*", "Temizlik görevlisi", "temizlik"),
    (r"(kat|oda) (görevli|personel|eleman)\w*", "Kat görevlisi", "temizlik"),
    (r"aşçı (yardımcı)\w*", "Aşçı yardımcısı", "yeme-icme"),
    (r"aşçı\w*|mutfak (personel|eleman|görevli)\w*", "Aşçı / mutfak personeli", "yeme-icme"),
    (r"garson (yardımcı)\w*", "Garson yardımcısı", "yeme-icme"),
    (r"garson\w*", "Garson", "yeme-icme"),
    (r"bulaşıkçı\w*", "Bulaşıkçı", "yeme-icme"),
    (r"barista\w*", "Barista", "yeme-icme"),
    (r"komi\w*|runner\w*", "Runner / komi", "yeme-icme"),
    (r"kasiyer\w*", "Kasiyer", "satis"),
    (r"tezgah(tar|çı)\w*|reyon (görevli|personel)\w*|market (görevli|personel|eleman)\w*", "Tezgâhtar", "satis"),
    (r"satış (danışman|görevli|temsilci|personel|eleman)\w*", "Satış görevlisi", "satis"),
    (r"mağaza (görevli|personel|eleman|çalışan)\w*|reyon", "Mağaza görevlisi", "satis"),
    (r"depo (sorumlu|görevli|personel|eleman|çalışan)\w*", "Depo görevlisi", "uretim"),
    (r"forklift\w*", "Forklift operatörü", "uretim"),
    (r"(üretim|fabrika) (işçi|personel|eleman|çalışan)\w*|paketleme (personel|eleman|işçi)\w*|kutulama\w*", "Üretim işçisi", "uretim"),
    (r"operatör\w*", "Operatör", "uretim"),
    (r"kurye\w*|motokurye\w*", "Kurye", "lojistik"),
    (r"şoför\w*|sürücü\w*|servis şoför\w*", "Şoför", "lojistik"),
    (r"güvenlik (görevli|personel)\w*", "Güvenlik görevlisi", "hizmet"),
    (r"(ön büro|resepsiyon)\w*", "Ön büro / resepsiyon görevlisi", "ofis"),
    (r"sekreter\w*|ofis (personel|eleman|görevli)\w*|büro (personel|eleman)\w*|idari (personel|işler)\w*", "Büro personeli", "ofis"),
    (r"muhasebe\w*|ön muhasebe\w*", "Muhasebe personeli", "ofis"),
    (r"çağrı merkezi\w*|müşteri temsilci\w*|müşteri hizmetleri\w*", "Müşteri temsilcisi", "ofis"),
    (r"asansör (bakım|teknisyen|usta|montaj)\w*|asansör\w* (usta|teknisyen)\w*", "Asansör teknisyeni", "teknik"),
    (r"(bakım|onarım|tamir)\w* (teknisyen|usta|personel|eleman)\w*|teknisyen\w*", "Teknisyen", "teknik"),
    (r"elektrik(çi)?\w* (usta|teknisyen)\w*|elektrikçi\w*", "Elektrik ustası", "teknik"),
    (r"kaynakçı\w*|boyacı\w*|tesisatçı\w*|marangoz\w*|montaj (eleman|usta|personel)\w*", "Usta / montaj elemanı", "teknik"),
    (r"çırak\w*", "Çırak", "teknik"),
    (r"bakıcı\w*|hasta bakıcı\w*", "Bakıcı", "hizmet"),
    (r"şube müdür\w*", "Şube müdürü", "yonetim"),
]

ILCELER = ["Çankaya", "Keçiören", "Yenimahalle", "Mamak", "Etimesgut", "Sincan", "Altındağ", "Pursaklar",
           "Gölbaşı", "Polatlı", "Kahramankazan", "Akyurt", "Elmadağ", "Çubuk", "Beypazarı"]
SEMTLER = {  # yalnız doğruluğundan emin olunan eşlemeler
    "Kızılay": "Çankaya", "Bahçelievler": "Çankaya", "Çukurambar": "Çankaya", "Balgat": "Çankaya",
    "Söğütözü": "Çankaya", "Dikmen": "Çankaya", "Sıhhiye": "Çankaya", "Tunalı": "Çankaya",
    "Çayyolu": "Çankaya", "Ümitköy": "Çankaya", "Yaşamkent": "Çankaya",
    "Ostim": "Yenimahalle", "İvedik": "Yenimahalle", "Batıkent": "Yenimahalle", "Demetevler": "Yenimahalle",
    "Macunköy": "Yenimahalle", "Gimat": "Yenimahalle", "Yenikent": "Sincan", "Temelli": "Sincan",
    "Eryaman": "Etimesgut", "Bağlıca": "Etimesgut", "Etlik": "Keçiören", "Kalaba": "Keçiören",
    "Ulus": "Altındağ", "Siteler": "Altındağ", "Boğaziçi": "Mamak", "Zerdalitepe": "Mamak",
}
CALISMA = [(r"part[- ]?time|yarı zamanlı|yarım gün|yarı gün", "Part time"),
           (r"tam zamanlı|full[- ]?time|tam gün", "Tam zamanlı")]


def kucuk(s):
    """Türkçe duyarlı küçük harf."""
    return (s or "").replace("I", "ı").replace("İ", "i").lower()


def temizle(s):
    s = unicodedata.normalize("NFC", s or "")
    s = "".join(c for c in s if unicodedata.category(c)[0] != "C" or c in "\n\t")
    return re.sub(r"[ \t]+", " ", s).strip()


def parmak_izi(metin):
    """Aynı ilanın tekrarını yakalamak için: harf ve rakam dışını atıp özetle."""
    t = re.sub(r"[^a-z0-9çğıöşü]+", "", kucuk(metin))
    return hashlib.sha1(t.encode("utf-8")).hexdigest()[:16]


def ucret_bul(d):
    """Yalnız 'maaş/ücret' yakınında TEK ve makul aylık tutar varsa yazar; aralık ya da birden çok tutar varsa boş."""
    m = re.search(r"(maaş|maas|ücret|net|brüt)", d)
    if not m:
        return ""
    pencere = d[m.end(): m.end() + 70]
    tutarlar = re.findall(r"\d{1,3}(?:[.,]\d{3})+|\d{4,6}|\d{2,3}\s*bin", pencere)
    sayilar = set()
    for t in tutarlar:
        ham = t.replace(" ", "")
        sayilar.add(int(re.sub(r"\D", "", ham)) * (1000 if ham.endswith("bin") else 1))
    sayilar = {n for n in sayilar if 15000 <= n <= 250000}
    if len(sayilar) != 1 or re.search(r"\bila\b|arası|arasında|\d\s*[-–]\s*\d", pencere):
        return ""
    n = sayilar.pop()
    return f"İşveren beyanı: {n:,}".replace(",", ".") + " TL"


def degerlendir(metin):
    """Serbest metni değerlendirir. Dönüş: dict(karar, gerekce, ilan, ayrimci_sayisi, parmak_izi)."""
    ham = temizle(metin)
    d = kucuk(ham)
    sonuc = {"karar": "reddet", "gerekce": "", "ilan": None, "ayrimci_sayisi": 0, "parmak_izi": parmak_izi(ham)}
    if len(ham) < 40 or not ILAN_NIYETI.search(d):
        sonuc["gerekce"] = "ilan metni değil (kısa ya da ilan ifadesi yok)"
        return sonuc
    for kalip, gerekce in RED:
        if re.search(kalip, d):
            sonuc["gerekce"] = gerekce
            return sonuc
    sonuc["ayrimci_sayisi"] = len(AYRIMCI.findall(d))

    # — pozisyon: birden fazla farklı pozisyon ya da hiç yok → beklet (tahmin yok) —
    bulunan, kapali = [], []
    for kalip, ad, kat in MEVKILER:
        for m in re.finditer(kalip, d):
            if any(m.start() < b and a < m.end() for a, b in kapali):
                continue  # daha özgül kalıp aynı yeri zaten aldı
            kapali.append((m.start(), m.end()))
            if (ad, kat) not in bulunan:
                bulunan.append((ad, kat))
    if len(bulunan) > 1:
        sonuc["karar"], sonuc["gerekce"] = "beklet", "birden fazla pozisyon geçiyor: " + ", ".join(a for a, _ in bulunan)
        return sonuc
    mevki, kategori = bulunan[0] if bulunan else (None, None)

    # — yer: birden fazla farklı ilçe geçiyorsa hangisinin işyeri olduğu belirsiz → beklet —
    ek = r"(?:['’]?(?:d[ae]n?|t[ae]n?|[ae]|[ıiuü]|y[ıi]|n[ıi]n|[ıi]n|[uü]n|daki|deki|taki|teki))?"
    semt_hit, ilce_hit = [], []
    for sm, il in SEMTLER.items():
        if re.search(r"(?<![a-zçğıöşü])" + kucuk(sm) + ek + r"(?![a-zçğıöşü])", d):
            semt_hit.append(sm); ilce_hit.append(il)
    for il in ILCELER:
        if re.search(r"(?<![a-zçğıöşü])" + kucuk(il) + ek + r"(?![a-zçğıöşü])", d):
            ilce_hit.append(il)
    farkli_ilce = sorted(set(ilce_hit))
    if len(farkli_ilce) > 1:
        sonuc["karar"], sonuc["gerekce"] = "beklet", "birden fazla ilçe geçiyor: " + ", ".join(farkli_ilce)
        return sonuc
    ilce = farkli_ilce[0] if farkli_ilce else ""
    semt = semt_hit[0] if len(set(semt_hit)) == 1 else ""
    eksik = [ad for ad, v in (("pozisyon", mevki), ("ilçe/semt", ilce)) if not v]
    if eksik:
        sonuc["karar"] = "beklet"
        sonuc["gerekce"] = "eksik veya belirsiz: " + ", ".join(eksik)
        return sonuc

    calisma = "Tam zamanlı"
    for kalip, ad in CALISMA:
        if re.search(kalip, d):
            calisma = ad
            break
    ilan = {
        "baslik": mevki, "ilce": ilce, "semt": semt or ilce, "calisma": calisma,
        "vardiya": "Vardiyalı" if "vardiya" in d else "",
        "kategori": kategori,
        "sigorta": bool(re.search(r"\bsgk\b|\bssk\b|sigortalı|sigorta (yapılır|var|işveren)|bağkur", d)),
        "yemek": bool(re.search(r"yemek", d)),
        "servis": bool(re.search(r"servis", d)),
        "tecrube": (False if re.search(r"tecrübe (şart )?değil|tecrübesiz|deneyim (şart )?değil|yetiştirilmek", d)
                    else True if re.search(r"tecrübeli|deneyimli|tecrübe (şart|aranır|gerekli)", d) else None),
        "ucret": ucret_bul(d),
    }
    sonuc["ilan"] = ilan
    sonuc["karar"] = "yayinla"
    sonuc["gerekce"] = "süzgeçten geçti" + (f"; {sonuc['ayrimci_sayisi']} ayrımcı ifade metne alınmadı" if sonuc["ayrimci_sayisi"] else "")
    return sonuc


def aciklama_kur(i):
    """Yayın metnini ayıklanan alanlardan kurar (ham metin kopyalanmaz). Dilbilgisi sabit şablondur."""
    yer = i["semt"] if i["semt"] and i["semt"] != i["ilce"] else ""
    konum = f"{i['ilce']}" + (f" ({yer})" if yer else "")
    cumleler = [f"{konum} bölgesindeki bir işletmede görev alacak {i['baslik'][0].lower() + i['baslik'][1:]} aranıyor."]
    imkan = []
    if i.get("sigorta"):
        imkan.append("sigorta")
    if i.get("yemek"):
        imkan.append("yemek")
    if i.get("servis"):
        imkan.append("servis")
    if imkan:
        son = imkan[-1]
        liste = ", ".join(imkan[:-1]) + (" ve " if len(imkan) > 1 else "") + son
        cumleler.append(f"İşveren; {liste} imkânı sunduğunu belirtiyor.")
    if i.get("tecrube") is True:
        cumleler.append("Tecrübeli adaylar tercih ediliyor.")
    elif i.get("tecrube") is False:
        cumleler.append("Tecrübe şartı yok.")
    return " ".join(cumleler)
