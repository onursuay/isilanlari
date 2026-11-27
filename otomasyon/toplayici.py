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
import eposta_kaynagi, grup_kaynagi, suzgec  # noqa: E402

EPOSTA_NIYET = re.compile(r"eleman|personel|aran[ıi]yor|al[ıi]nacak|alınacaktır|iş ilan|işe al|kadro|usta|çalışma arkadaş|garson|kasiyer|şoför|kurye")
EPOSTA_HATASI = None  # e-posta kutusuna girilemezse dolar; hat tur sonunda bildirir
GRUP_HATASI = None    # Facebook grubu sekmesi okunamazsa dolar (27.11.2026); hat tur sonunda bildirir

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
            # 50: koşular arası bir konuşmaya çok mesaj gelirse eskiler okunmadan kalmasın (önce 20'ydi)
            m = al(f"{k['id']}/messages", {"fields": "id,message,created_time,from,attachments{mime_type}", "limit": 50}, jeton)
            for x in m.get("data", []):
                gonderen = (x.get("from") or {}).get("id", "")
                if gonderen == SAYFA_ID:
                    continue  # kendi yanıtımız
                if iso(x["created_time"]) <= baslangic:
                    continue
                ekler = [a.get("mime_type", "") for a in (x.get("attachments") or {}).get("data", [])]
                if not x.get("message") and not ekler:
                    continue  # sticker/beğeni gibi boş öğe
                # 26.11.2026: işverenler ilanı görsel olarak da gönderiyor; metinsiz mesaj eskiden sessizce
                # atlanıyordu. Artık "beklet" kararı alır ve yayın denetçisi Telegram'a bildirir.
                sonuc.append({"id": x["id"], "platform": platform, "konusma": k["id"],
                              "zaman": x["created_time"], "metin": x.get("message") or "", "ekler": ekler})
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
    # e-posta (26.11.2026): ilk çalışmada başlangıç bugüne kurulur, geçmiş kutu yayınlanmaz
    global EPOSTA_HATASI
    EPOSTA_HATASI = None
    if geriye_gun is None and not durum.get("eposta_baslangic"):
        durum["eposta_baslangic"] = simdi.isoformat()
    else:
        try:
            mesajlar += eposta_kaynagi.yeni_epostalar(baslangic if geriye_gun is not None else iso(durum["eposta_baslangic"]))
            mesajlar.sort(key=lambda r: r["zaman"])
        except RuntimeError as e:
            EPOSTA_HATASI = str(e)  # öteki kaynaklar yine işlenir; hat tur sonunda hata verip bildirir
            print(f"  ! {e}")
    # Facebook grubu (27.11.2026): Mac'teki köprü Chrome taraması E-Tablo'ya yazar, hat oradan okur
    global GRUP_HATASI
    GRUP_HATASI = None
    if geriye_gun is None and grup_kaynagi.yapilandirildi():
        try:
            mesajlar += grup_kaynagi.yeni_mesajlar(durum["islenen"])
            mesajlar.sort(key=lambda r: r["zaman"])
            yas, kalp = grup_kaynagi.kalp_atisi()
            # K1 "KAPALI": tarama Owner kararıyla durduruldu (27.11.2026, Meta hesabı riske girmesin) → uyarı yok
            if not kalp.startswith("KAPALI") and (yas is None or yas > grup_kaynagi.KALP_SAAT or "HATA" in kalp or "EKSİK" in kalp):
                GRUP_HATASI = f"Mac grup taraması güncel değil ya da hatalı (K1: {kalp or 'boş'}); köprü Chrome açık mı?"
                print(f"  ! {GRUP_HATASI}")
        except Exception as e:  # noqa: BLE001 — öteki kaynaklar yine işlenir
            GRUP_HATASI = f"Facebook grubu sekmesi okunamadı: {type(e).__name__}: {str(e)[:150]}"
            print(f"  ! {GRUP_HATASI}")
    gorulen_izler = {v.get("iz") for v in durum["islenen"].values() if v.get("iz")}
    kararlar = []
    for r in mesajlar:
        if r["id"] in durum["islenen"]:
            continue
        if r.get("on_karar"):  # grup: eski ya da erişilemeyen gönderi süzgece girmez
            s = {"karar": r["on_karar"][0], "gerekce": r["on_karar"][1], "ilan": None, "ilanlar": None,
                 "parmak_izi": suzgec.parmak_izi(r["id"])}
        else:
            s = suzgec.degerlendir(r["metin"])
        # markanın kendi adı ("Ankara İş İlanı") niyet sayılmaz: kutuya gelen her ileti bu adı içerebilir
        if r["platform"] == "eposta" and not EPOSTA_NIYET.search(re.sub(r"ankara iş ilan\w*", " ", suzgec.kucuk(r["metin"]))):
            # kutuya düşen SEO/dolandırıcılık iletileri (İngilizce, ekli) her turda boş uyarı üretmesin
            s.update(karar="reddet", gerekce="e-posta iş ilanı ifadesi taşımıyor", ilan=None, ilanlar=None)
        elif r.get("ekler") and s["karar"] != "yayinla" and not r.get("on_karar"):
            # ilan metin yerine görselde/dosyada olabilir: reddetmek ya da yanlış gerekçeyle bekletmek ilanı kaçırır
            s["karar"] = "beklet"
            s["gerekce"] = "ilan görsel veya dosya olarak gönderilmiş (" + ", ".join(sorted(set(r["ekler"]))) + "); ekip ilanı elle girmeli"
            s["ilan"], s["ilanlar"] = None, None
            if not r["metin"].strip():
                s["parmak_izi"] = suzgec.parmak_izi(r["id"])  # boş metnin izi herkes için aynı olurdu
        iz = s["parmak_izi"]
        if iz in gorulen_izler and s["karar"] == "yayinla":
            s["karar"], s["gerekce"] = "reddet", "aynı ilan daha önce işlendi (mükerrer)"
        gorulen_izler.add(iz)
        # bir mesajda birden çok pozisyon varsa her biri ayrı karar olur (ilki mesaj kimliğini taşır)
        ilanlar = s.get("ilanlar") if s["karar"] == "yayinla" else None
        parcalar = ilanlar or [s["ilan"]]
        for n, ilan in enumerate(parcalar, 1):
            kid = r["id"] if n == 1 else f"{r['id']}#{n}"
            kayit = {"id": kid, "platform": r["platform"], "konusma": r["konusma"], "zaman": r["zaman"], "satir": r.get("satir"),
                     "karar": s["karar"], "gerekce": s["gerekce"], "iz": iz if n == 1 else f"{iz}#{n}", "ilan": ilan}
            kararlar.append(kayit)
            if not kuru:
                # depoya yalnız kimlik + karar + gerekçe + parmak izi yazılır
                durum["islenen"][kid] = {"karar": s["karar"], "gerekce": s["gerekce"], "iz": kayit["iz"],
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
