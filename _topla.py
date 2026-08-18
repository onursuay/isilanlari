#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ankara İş İlanları — Facebook sayfa mesaj kutusundan ilan toplayıcı.

Akış: mesajları çek → sahte/ücret talebi filtresinden geçir → ilan alanlarını ayıkla
      → veri/ilanlar.json'a ekle → node _uret.mjs ile siteyi üret.
Kullanım:
    python3 _topla.py            # topla, filtrele, siteyi üret
    python3 _topla.py --kuru     # hiçbir şey yazma, ne olacağını göster
"""
import json, os, re, subprocess, sys, unicodedata, urllib.parse, urllib.request
from datetime import datetime, timezone, timedelta

KOK = os.path.dirname(os.path.abspath(__file__))
SAYFA_ID = "106370611224653"
GIZLI = os.path.expanduser("~/.claude/secrets/meta_credentials.json")
DURUM = os.path.join(KOK, "veri", "_toplama_durumu.json")
ILANLAR = os.path.join(KOK, "veri", "ilanlar.json")
REDDEDILEN = os.path.join(KOK, "veri", "_reddedilenler.json")
TR = timezone(timedelta(hours=3))

# ——— filtre: bu kalıplardan biri varsa ilan YAYINLANMAZ ———
RED_KALIPLARI = [
    (r"kapora|depozito|teminat", "kapora veya teminat isteniyor"),
    (r"kargo (ücret|bedel|parası)|kargo ücreti", "kargo ücreti isteniyor"),
    (r"üyelik (ücret|bedel)|kayıt (ücret|bedel|parası)", "üyelik veya kayıt ücreti isteniyor"),
    (r"eğitim (ücret|bedel)i", "eğitim ücreti isteniyor"),
    (r"sigorta (ücret|bedel)i (yatır|öde)", "sigorta bedeli isteniyor"),
    (r"iban|hesap numaram|para (yatır|gönder)", "para transferi isteniyor"),
    (r"kimlik (fotokopi|foto|önyüz)", "kimlik belgesi isteniyor"),
    (r"evde paketleme|evde iş verilir|eve iş", "evde paketleme vaadi"),
    (r"sermayesiz|yüksek kazanç|günlük \d+ ?bin", "gerçek dışı kazanç vaadi"),
    (r"bahis|casino|kripto|forex", "yasak kategori"),
]
ILCELER = ["Çankaya","Keçiören","Yenimahalle","Mamak","Etimesgut","Sincan","Altındağ","Pursaklar",
           "Gölbaşı","Polatlı","Kahramankazan","Akyurt","Elmadağ","Çubuk","Beypazarı"]
SEMTLER = {"Kızılay":"Çankaya","Bahçelievler":"Çankaya","Çukurambar":"Çankaya","Balgat":"Çankaya",
           "Söğütözü":"Çankaya","Dikmen":"Çankaya","Ostim":"Yenimahalle","İvedik":"Yenimahalle",
           "Batıkent":"Yenimahalle","Demetevler":"Yenimahalle","İncirli":"Keçiören","Etlik":"Keçiören",
           "Ulus":"Altındağ","Siteler":"Altındağ","Eryaman":"Etimesgut","Sıhhiye":"Çankaya","Tunalı":"Çankaya"}
CALISMA = [(r"part[- ]?time|yarı zamanlı|yarim gun|yarım gün", "Part time"),
           (r"tam zamanlı|full[- ]?time|tam gün", "Tam zamanlı"),
           (r"vardiya", "Vardiyalı")]

def yukle(yol, varsayilan):
    try:
        with open(yol, encoding="utf-8") as f: return json.load(f)
    except FileNotFoundError: return varsayilan

def kaydet(yol, veri):
    os.makedirs(os.path.dirname(yol), exist_ok=True)
    with open(yol, "w", encoding="utf-8") as f: json.dump(veri, f, ensure_ascii=False, indent=2)

def kucuk(s):  # Türkçe duyarlı küçültme
    return s.replace("I","ı").replace("İ","i").lower()

def temizle(s):
    """Gelen metin siteye gömülüyor: etiket açma/kapama ve kontrol karakterlerini at."""
    s = s.replace("<", " ").replace(">", " ").replace("\u2028", " ").replace("\u2029", " ")
    s = "".join(c for c in s if unicodedata.category(c)[0] != "C" or c in "\n\t")
    return re.sub(r"[ \t]+", " ", s).strip()

def graph(yol, params, token):
    params = dict(params); params["access_token"] = token
    url = f"https://graph.facebook.com/v21.0/{yol}?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)

def sayfa_tokeni():
    with open(GIZLI, encoding="utf-8") as f: kimlik = json.load(f)
    kul = kimlik["access_token"]
    for h in graph("me/accounts", {"fields": "id,access_token", "limit": 200}, kul)["data"]:
        if h["id"] == SAYFA_ID: return h["access_token"]
    raise SystemExit("Sayfa tokeni bulunamadı: " + SAYFA_ID)

def filtrele(metin):
    d = kucuk(metin)
    for kalip, gerekce in RED_KALIPLARI:
        if re.search(kalip, d): return gerekce
    return None

def ayikla(metin):
    """Serbest metinden ilan alanlarını çıkarır. Emin olunamayan alan boş bırakılır."""
    d = kucuk(metin)
    ilce = semt = ""
    for s, i in SEMTLER.items():
        if kucuk(s) in d: semt, ilce = s, i; break
    if not ilce:
        for i in ILCELER:
            if kucuk(i) in d: ilce = i; break
    calisma = "Tam zamanlı"
    for kalip, ad in CALISMA:
        if re.search(kalip, d): calisma = ad; break
    baslik = ""
    for kalip in [r"([a-zçğıöşü ]{4,40}?)\s*(aran(ıyor|maktadır)|alınacaktır|alınacak)",
                  r"(eleman|personel|görevli|usta|şoför|kurye|garson|aşçı|temizlikçi)[a-zçğıöşü ]{0,25}"]:
        m = re.search(kalip, d)
        if m: baslik = m.group(1 if m.lastindex else 0).strip(); break
    return {
        "baslik": (temizle(baslik)[:60].strip().capitalize() or "İş ilanı"),
        "ilce": ilce, "semt": semt or ilce, "calisma": calisma,
        "vardiya": "Vardiyalı" if "vardiya" in d else ("Akşam" if re.search(r"akşam|gece", d) else "Gündüz"),
        "kategori": "genel",
        "sigorta": bool(re.search(r"sigorta|ssk|bağkur", d)),
        "tecrube": bool(re.search(r"tecrübe(li)?|deneyim(li)?", d)),
    }

def main():
    kuru = "--kuru" in sys.argv
    token = sayfa_tokeni()
    durum = yukle(DURUM, {"islenen_mesajlar": [], "son_kod": 1482})
    veri = yukle(ILANLAR, {"guncelleme": "", "ilanlar": []})
    reddedilen = yukle(REDDEDILEN, {"kayitlar": []})
    islenen = set(durum["islenen_mesajlar"])

    konusmalar = graph(f"{SAYFA_ID}/conversations", {"fields": "id,updated_time", "limit": 25}, token)
    yeni, red = [], []
    for k in konusmalar.get("data", []):
        mesajlar = graph(f"{k['id']}/messages", {"fields": "id,message,created_time,from", "limit": 12}, token)
        for m in mesajlar.get("data", []):
            mid, metin = m["id"], (m.get("message") or "").strip()
            if mid in islenen or len(metin) < 40: continue
            if (m.get("from") or {}).get("id") == SAYFA_ID: continue   # kendi yanıtımız
            islenen.add(mid)
            gerekce = filtrele(metin)
            if gerekce:
                red.append({"mesaj_id": mid, "gerekce": gerekce, "tarih": m["created_time"], "ozet": metin[:160]})
                continue
            alan = ayikla(metin)
            if not alan["ilce"]:            # konumu çıkaramadıysak yayınlamayız
                red.append({"mesaj_id": mid, "gerekce": "konum belirlenemedi", "tarih": m["created_time"], "ozet": metin[:160]})
                continue
            durum["son_kod"] += 1
            alan.update({"kod": f"A-{durum['son_kod']}", "aciklama": temizle(metin)[:400],
                         "kaynak": "facebook-mesaj", "tarih": m["created_time"][:10]})
            yeni.append(alan)

    print(f"Yeni ilan: {len(yeni)} · reddedilen: {len(red)}")
    for i in yeni: print(f"  + {i['kod']} {i['baslik']} — {i['ilce']} ({i['calisma']})")
    for r in red:  print(f"  – reddedildi: {r['gerekce']} → {r['ozet'][:60]}")
    if kuru:
        print("(kuru çalışma — hiçbir dosya yazılmadı)"); return

    if yeni:
        veri["ilanlar"] = yeni + veri["ilanlar"]
        veri["guncelleme"] = datetime.now(TR).strftime("%Y-%m-%d")
        kaydet(ILANLAR, veri)
    reddedilen["kayitlar"] = red + reddedilen["kayitlar"]
    kaydet(REDDEDILEN, reddedilen)
    durum["islenen_mesajlar"] = list(islenen)[-500:]
    kaydet(DURUM, durum)

    if yeni:
        subprocess.run(["node", os.path.join(KOK, "_uret.mjs")], check=True)
        print("Site yeniden üretildi. Yayına almak için: git add -A && git commit && git push")

if __name__ == "__main__":
    main()
