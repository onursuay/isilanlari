#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ankara İş İlanı — gelen kutusu toplayıcı (YALNIZ OKUMA).

Facebook sayfası mesaj kutusu (Messenger) ve Instagram mesajlarından yeni işveren ilanlarını toplar,
süzgeçten geçirir ve kararını verir. Hiçbir şey yazmaz/yayınlamaz; yayın katmanı ayrıdır.

Gizlilik: depo herkese açıktır. Durum dosyasına yalnız mesaj kimliği, karar, gerekçe ve özet parmak izi
yazılır; ilan metni, telefon, ad ve e-posta ASLA yazılmaz.

Kullanım:
    python3 otomasyon/toplayici.py --kuru                   # durum dosyasına yazmaz, kararları gösterir
    python3 otomasyon/toplayici.py --kuru --geriye-gun 3650  # eski gelen kutusuyla süzgeci sınar
"""
import json, os, re, sys, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import suzgec  # noqa: E402

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAYFA_ID = "106370611224653"
DURUM = os.path.join(KOK, "veri", "_hat_durumu.json")
TR = timezone(timedelta(hours=3))
SURUM = "v21.0"


def jeton_oku():
    """Bulutta META_SAYFA_TOKEN (yalnız sayfa jetonu); yerelde merkezi dosyadan sayfa jetonu türetilir."""
    t = os.environ.get("META_SAYFA_TOKEN", "").strip()
    if t:
        return t
    yol = os.path.expanduser("~/.claude/secrets/meta_credentials.json")
    kul = json.load(open(yol, encoding="utf-8"))["access_token"]
    hesap = al("me/accounts", {"fields": "id,access_token", "limit": 200}, kul)
    for h in hesap.get("data", []):
        if h["id"] == SAYFA_ID:
            return h["access_token"]
    raise SystemExit("Sayfa jetonu bulunamadı")


def al(yol, alanlar, jeton):
    alanlar = dict(alanlar)
    alanlar["access_token"] = jeton
    adres = f"https://graph.facebook.com/{SURUM}/{yol}?" + urllib.parse.urlencode(alanlar)
    try:
        return json.load(urllib.request.urlopen(adres))
    except urllib.error.HTTPError as e:
        govde = e.read().decode("utf-8", "ignore")
        # ham yanıtın jeton içermeyen kısmı: kod ve ileti
        try:
            h = json.loads(govde).get("error", {})
            raise RuntimeError(f"Graph hata {h.get('code')}/{h.get('error_subcode')}: {h.get('message')}")
        except ValueError:
            raise RuntimeError(f"Graph hata HTTP {e.code}")


def durum_yukle():
    try:
        return json.load(open(DURUM, encoding="utf-8"))
    except FileNotFoundError:
        return None


def durum_yaz(d):
    os.makedirs(os.path.dirname(DURUM), exist_ok=True)
    with open(DURUM, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=1, sort_keys=True)


def iso(s):
    """Graph (…+0000) ve kendi yazdığımız (…22:20:27.832835+03:00) zaman biçimlerini okur."""
    s = s.strip().replace("Z", "+00:00")
    s = re.sub(r"([+-]\d{2})(\d{2})$", r"\1:\2", s)
    return datetime.fromisoformat(s)


def yeni_mesajlar(jeton, baslangic):
    """baslangic'tan sonra işverenden (dış gönderici) gelen mesajlar: Messenger + Instagram."""
    sonuc = []
    for platform, ek in (("messenger", {}), ("instagram", {"platform": "instagram"})):
        p = {"fields": "id,updated_time", "limit": 50}
        p.update(ek)
        try:
            kons = al(f"{SAYFA_ID}/conversations", p, jeton)
        except RuntimeError as e:
            print(f"  ! {platform} konuşmaları okunamadı: {e}")
            continue
        for k in kons.get("data", []):
            if iso(k["updated_time"]) <= baslangic:
                continue
            m = al(f"{k['id']}/messages", {"fields": "id,message,created_time,from", "limit": 20}, jeton)
            for x in m.get("data", []):
                gonderen = (x.get("from") or {}).get("id", "")
                if gonderen == SAYFA_ID or not x.get("message"):
                    continue  # kendi yanıtımız ya da metinsiz (görsel/sticker)
                if iso(x["created_time"]) <= baslangic:
                    continue
                sonuc.append({"id": x["id"], "platform": platform, "konusma": k["id"],
                              "zaman": x["created_time"], "metin": x["message"]})
    sonuc.sort(key=lambda r: r["zaman"])
    return sonuc


def calistir(kuru=False, geriye_gun=None):
    jeton = jeton_oku()
    durum = durum_yukle()
    simdi = datetime.now(TR)
    if geriye_gun is not None:
        baslangic = simdi - timedelta(days=geriye_gun)
        durum = durum or {"islenen": {}, "baslangic": simdi.isoformat()}
    elif durum is None:
        # İlk kurulum: geçmiş gelen kutusu YAYINLANMAZ; hat bundan sonrasını işler.
        durum = {"baslangic": simdi.isoformat(), "islenen": {}, "yayinlanan": {}}
        if not kuru:
            durum_yaz(durum)
        print(f"İlk kurulum: başlangıç {simdi:%d.%m.%Y %H:%M}, geçmiş mesajlar işlenmeyecek.")
        return durum, []
    else:
        baslangic = iso(durum["baslangic"])

    mesajlar = yeni_mesajlar(jeton, baslangic)
    gorulen_izler = {v.get("iz") for v in durum["islenen"].values() if v.get("iz")}
    kararlar = []
    for r in mesajlar:
        if r["id"] in durum["islenen"]:
            continue
        s = suzgec.degerlendir(r["metin"])
        iz = s["parmak_izi"]
        if iz in gorulen_izler and s["karar"] == "yayinla":
            s["karar"], s["gerekce"] = "reddet", "aynı ilan daha önce işlendi (mükerrer)"
        gorulen_izler.add(iz)
        kayit = {"id": r["id"], "platform": r["platform"], "konusma": r["konusma"], "zaman": r["zaman"],
                 "karar": s["karar"], "gerekce": s["gerekce"], "iz": iz, "ilan": s["ilan"]}
        kararlar.append(kayit)
        if not kuru:
            # depoya yalnız kimlik + karar + gerekçe + parmak izi yazılır
            durum["islenen"][r["id"]] = {"karar": s["karar"], "gerekce": s["gerekce"], "iz": iz,
                                         "zaman": r["zaman"], "konusma": r["konusma"]}
    if not kuru:
        durum_yaz(durum)
    return durum, kararlar


def maske(s):
    return re.sub(r"\d", "#", s)


if __name__ == "__main__":
    kuru = "--kuru" in sys.argv
    g = None
    if "--geriye-gun" in sys.argv:
        g = int(sys.argv[sys.argv.index("--geriye-gun") + 1])
    durum, kararlar = calistir(kuru=kuru, geriye_gun=g)
    print(f"Yeni mesaj kararı: {len(kararlar)}")
    for k in kararlar:
        ilan = k["ilan"] or {}
        ozet = f"{ilan.get('baslik','-')} · {ilan.get('ilce','-')}/{ilan.get('semt','-')} · {ilan.get('calisma','-')} · {ilan.get('ucret','') or 'ücret yok'}" if ilan else ""
        print(f"  [{k['zaman'][:10]}] {k['platform']:9} {k['karar']:8} {k['gerekce']} {('→ ' + ozet) if ozet else ''}")
