#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ankara İş İlanı — otomatik ilan hattı (orkestra).

Modlar (varsayılan: hazirlik):
  hazirlik  gelen kutusunu okur, süzer, kararları kaydeder; HİÇBİR ŞEY YAYINLAMAZ (başvuru yolu kapalıyken).
  yayinla   YAYIN_ACIK=1 ise: yayına uygun ilanı siteye ekler, kartı üretir, siteyi yayına alır,
            Facebook + Instagram'da paylaşır, her adımı geri okur.
  sinama    Meta yayın yolunu YAYINLAMADAN sınar: yayınlanmamış Facebook fotoğrafı (sonra silinir) +
            Instagram kapsayıcısı (FINISHED'a kadar, yayınlanmaz).

Gizlilik: depo herkese açık. Durum dosyasına yalnız kimlik/karar/gerekçe yazılır; ilan metni ve iletişim yazılmaz.
Günlük çıktıda yalnız sayılar ve ilan kodları yer alır.
"""
import json, os, re, subprocess, sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import form_kaynagi, grup_kaynagi, suzgec, toplayici  # noqa: E402

KOK = toplayici.KOK
ILANLAR = os.path.join(KOK, "veri", "ilanlar.json")
SITE = "https://ankaraisilani.com"


def calistir(cmd, **kw):
    return subprocess.run(cmd, cwd=KOK, check=True, **kw)


def git_yayinla(mesaj, yollar, izlenenler_de=False):
    calistir(["git", "config", "user.name", "ankara-is-ilani-hat"])
    calistir(["git", "config", "user.email", "hat@ankaraisilani.com"])
    calistir(["git", "add", "--"] + yollar)
    if izlenenler_de:
        # _uret.mjs yeni ilanla listede olmayan sayfaları da yeniden yazabiliyor; hepsi aynı committe gider
        calistir(["git", "add", "-u"])
    sonuc = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=KOK)
    if sonuc.returncode == 0:
        return False
    calistir(["git", "commit", "-q", "-m", mesaj])
    kalan = subprocess.run(["git", "status", "--porcelain", "--untracked-files=no"], cwd=KOK,
                           capture_output=True, text=True).stdout.strip()
    if kalan:
        print("  ! commit dışı kalan değişiklik:", kalan.replace("\n", " | "))
    # 19-24.11.2026: commit dışı değişiklik 'pull --rebase'i düşürüyordu; autostash ile hat durmaz
    calistir(["git", "pull", "-q", "--rebase", "--autostash", "origin", "main"])
    calistir(["git", "push", "-q", "origin", "main"])
    return True


def hazirlik():
    durum, kararlar = toplayici.calistir(kuru=True)
    sayac = {"yayinla": 0, "beklet": 0, "reddet": 0}
    for k in kararlar:
        sayac[k["karar"]] += 1
    # yayın kapalıyken yalnız beklet/reddet kalıcılaşır; 'yayinla' adayları açılışta yeniden değerlendirilir
    for k in kararlar:
        if k["karar"] != "yayinla":
            durum["islenen"][k["id"]] = {"karar": k["karar"], "gerekce": k["gerekce"], "iz": k["iz"],
                                         "zaman": k["zaman"], "konusma": k["konusma"]}
    toplayici.durum_yaz(durum)
    print(f"HAZIRLIK: yeni mesaj kararı {len(kararlar)} · yayına uygun {sayac['yayinla']} · bekleyen {sayac['beklet']} · reddedilen {sayac['reddet']}")
    for k in kararlar:
        print(f"  {k['zaman'][:10]} {k['platform']:9} {k['karar']:8} {k['gerekce']}")
    return sayac


def yayinla():
    if os.environ.get("YAYIN_ACIK") != "1":
        raise SystemExit("YAYIN_ACIK=1 değil: yayın kapalı (başvuru yolu hazır değilken hat yayınlamaz).")
    import yayinci
    durum, kararlar = toplayici.calistir(kuru=False)
    # site "İlan Ver" formu (E-Tablo): aynı kurallar; beklet/reddet sonucu hemen Durum sütununa yazılır
    if form_kaynagi.yapilandirildi():
        form = form_kaynagi.yeni_kararlar(durum)
        for k in form:
            if k["karar"] != "yayinla":
                etiket = "bekletildi, ekip kontrol etmeli" if k["karar"] == "beklet" else "reddedildi"
                form_kaynagi.durum_yaz(k["satir"], f"Otomatik: {etiket} ({k['gerekce']})")
                durum["form_islenen"][k["id"]] = {"karar": k["karar"], "gerekce": k["gerekce"], "iz": k["iz"]}
        kararlar += form
    else:
        print("  ! site formu kaynağı yapılandırılmamış (GOOGLE_SA_* / ILAN_SHEET_ID yok), atlandı")
    # Facebook grubu (27.11.2026): beklet/reddet kararı hemen 'Facebook Grubu' sekmesinin Durum sütununa
    for k in kararlar:
        if k["platform"] == "facebook-grubu" and k["karar"] != "yayinla" and "#" not in k["id"]:
            etiket = "bekletildi, ekip kontrol etmeli" if k["karar"] == "beklet" else "reddedildi"
            grup_kaynagi.durum_yaz(k["satir"], f"Otomatik: {etiket} ({k['gerekce']})")
    adaylar = [k for k in kararlar if k["karar"] == "yayinla"]
    print(f"YAYIN: {len(adaylar)} yayına uygun ilan")
    for k in kararlar:
        print(f"  {k['zaman'][:10]} {k['platform']:9} {k['karar']:8} {k['gerekce']}")
    durum.setdefault("yayinlanan", {})
    veri = json.load(open(ILANLAR, encoding="utf-8"))
    bekleyen_paylasim(yayinci, durum, veri)  # önceki koşuda sitesi geç açıldığı için paylaşılamayanlar
    # aynı ilan (aynı kişi aynı metni yeniden gönderdi) ikinci kez yayınlanmaz: 24.11.2026 A-1485/A-1486 vakası
    bugun = datetime.now(toplayici.TR).strftime("%Y-%m-%d")
    gorulen = {_imza(i): i["kod"] for i in veri["ilanlar"] if _gun_farki(i.get("tarih"), bugun) <= TEKRAR_GUN}
    tekil = []
    for k in adaylar:
        onceki = gorulen.get(_imza(k["ilan"]))
        if onceki:
            gerekce = f"aynı ilan zaten yayında ({onceki})"
            print(f"  = {k['zaman'][:10]} {k['platform']:9} tekrar ilan, yayınlanmadı: {gerekce}")
            if k["platform"] == "site-formu":
                form_kaynagi.durum_yaz(k["satir"], f"Otomatik: {gerekce}")
                durum["form_islenen"][k["id"]] = {"karar": "reddet", "gerekce": gerekce, "iz": k["iz"]}
            elif k["id"] in durum.get("islenen", {}):
                durum["islenen"][k["id"]].update({"karar": "reddet", "gerekce": gerekce})
                if k["platform"] == "facebook-grubu" and "#" not in k["id"]:
                    grup_kaynagi.durum_yaz(k["satir"], f"Otomatik: reddedildi ({gerekce})")
            continue
        gorulen[_imza(k["ilan"])] = "bu koşu"
        tekil.append(k)
    adaylar = tekil
    if not adaylar:
        # tekrar-ilan "reddet" güncellemesi bellekteydi, dosyaya hiç yazılmıyordu (26.11.2026: 25.11 mesajı
        # durumda "yayinla" görünüp yayınlanmamıştı) → önce diske yaz, sonra gönder
        toplayici.durum_yaz(durum)
        git_yayinla("Hat: gelen kutusu kararları", ["veri/_hat_durumu.json"])  # beklet/reddet kararları kaybolmasın
        return
    son = max([int(re.sub(r"\D", "", i["kod"])) for i in veri["ilanlar"]] + [int(durum.get("son_kod", 0))])
    yeni = []
    for k in adaylar:
        son += 1
        i = dict(k["ilan"])
        i.update({"kod": f"A-{son}", "aciklama": suzgec.aciklama_kur(k["ilan"]),
                  "kaynak": "site-formu" if k["platform"] == "site-formu" else "hat", "tarih": bugun})
        yeni.append((k, i))
    veri["ilanlar"] = [i for _, i in yeni] + veri["ilanlar"]
    veri["guncelleme"] = bugun
    json.dump(veri, open(ILANLAR, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    durum["son_kod"] = son
    for k, i in yeni:
        gecici = os.path.join(KOK, "veri", f"_kart_{i['kod']}.json")
        json.dump(i, open(gecici, "w", encoding="utf-8"), ensure_ascii=False)
        calistir(["node", "otomasyon/kart.mjs", gecici, f"medya/ilan-{i['kod'].lower()}.jpg"])
        os.remove(gecici)
    calistir(["node", "_uret.mjs"])
    toplayici.durum_yaz(durum)
    yollar = ["veri/ilanlar.json", "veri/_hat_durumu.json", "medya", "ilan", "guncel-ilanlar.html", "index.html", "genel-ilanlar.html", "sitemap.xml"]
    git_yayinla("Hat: " + ", ".join(i["kod"] for _, i in yeni) + " yayına alındı", yollar, izlenenler_de=True)
    # grup satırına yayınlanan kod(lar) yazılır; Mac taraması bunu görüp gönderiyi grupta onaylar
    grup_kodlari = {}
    for k, i in yeni:
        if k["platform"] == "facebook-grubu":
            grup_kodlari.setdefault(k["satir"], []).append(i["kod"])
    for satir, kodlar in grup_kodlari.items():
        grup_kaynagi.durum_yaz(satir, "Otomatik: yayınlandı " + ", ".join(kodlar))
    for k, i in yeni:
        bilgi = {"mesaj": k["id"], "platform": k["platform"], "satir": k.get("satir"), "iz": k.get("iz"), "deneme": 0}
        sosyal_paylas(yayinci, durum, i, bilgi, deneme=40)
        toplayici.durum_yaz(durum)
    git_yayinla("Hat: yayın kayıtları", ["veri/_hat_durumu.json"])


TEKRAR_GUN = 30
TEKRAR_ALANLARI = ("baslik", "ilce", "semt", "kategori", "ucret", "calisma", "vardiya", "servis", "yemek", "sigorta", "tecrube")


def _imza(i):
    return tuple(re.sub(r"\s+", " ", str(i.get(a) or "")).strip().casefold() for a in TEKRAR_ALANLARI)


def _gun_farki(tarih, bugun):
    try:
        return (datetime.strptime(bugun, "%Y-%m-%d") - datetime.strptime(tarih, "%Y-%m-%d")).days
    except (TypeError, ValueError):
        return 10 ** 6


def sosyal_paylas(yayinci, durum, i, bilgi, deneme=40):
    """Site yayındaysa Facebook + Instagram'da paylaşır; değilse ilanı bekleyen listesine koyar (sonraki koşu yeniden dener).
    Aynı ilan iki kez paylaşılmaz: 'yayinlanan' kaydı varsa hiçbir şey yapılmaz."""
    kod = i["kod"]
    bekleyen = durum.setdefault("sosyal_bekleyen", {})
    if kod in durum["yayinlanan"]:
        bekleyen.pop(kod, None)
        return True
    gorsel = f"{SITE}/medya/ilan-{kod.lower()}.jpg"
    ilan_adresi = f"{SITE}/ilan/{suzgec_slug(i['baslik'])}-{kod.lower()}"
    if not yayinci.url_bekle(gorsel, deneme, 6) or not yayinci.url_bekle(ilan_adresi, deneme, 6, tur="text/html"):
        bilgi["deneme"] = bilgi.get("deneme", 0) + 1
        bekleyen[kod] = bilgi
        print(f"  ! {kod}: site henüz yayında değil, sosyal paylaşım sonraki koşuya kaldı (deneme {bilgi['deneme']})")
        if bilgi.get("platform") == "site-formu" and bilgi["deneme"] == 1:
            durum.setdefault("form_islenen", {})[bilgi["mesaj"]] = {"karar": "yayinla", "kod": kod, "iz": bilgi.get("iz"), "sosyal": "bekliyor"}
            form_kaynagi.durum_yaz(bilgi["satir"], f"Otomatik: sitede {kod} olarak eklendi, sosyal paylaşım sonraki koşuda denenecek")
        return False
    metin = yayinci.paylasim_metni(i, ilan_adresi)
    fb = yayinci.fb_foto(gorsel, metin)
    ig = yayinci.ig_yayinla(yayinci.ig_hazirla(gorsel, metin))
    durum["yayinlanan"][kod] = {"facebook": fb.get("link"), "instagram": ig.get("link"), "site": ilan_adresi,
                                "zaman": datetime.now(toplayici.TR).isoformat(timespec="seconds"), "mesaj": bilgi["mesaj"]}
    bekleyen.pop(kod, None)
    print(f"  ✓ {kod} → facebook={'var' if fb.get('link') else 'YOK'} instagram={'var' if ig.get('link') else 'YOK'}")
    if bilgi.get("platform") == "site-formu":
        durum.setdefault("form_islenen", {})[bilgi["mesaj"]] = {"karar": "yayinla", "kod": kod, "iz": bilgi.get("iz")}
        form_kaynagi.durum_yaz(bilgi["satir"], f"Otomatik: yayınlandı {kod} · {ilan_adresi} · "
                               f"Facebook {'var' if fb.get('link') else 'YOK'} · Instagram {'var' if ig.get('link') else 'YOK'}")
    return True


def bekleyen_paylasim(yayinci, durum, veri):
    bekleyen = durum.get("sosyal_bekleyen") or {}
    if not bekleyen:
        return
    ilanlar = {i["kod"]: i for i in veri["ilanlar"]}
    for kod, bilgi in list(bekleyen.items()):
        if kod not in ilanlar:  # ilan siteden kaldırıldıysa paylaşılmaz
            print(f"  - {kod}: sitede yok, bekleyen paylaşım kaldırıldı")
            bekleyen.pop(kod)
            continue
        sosyal_paylas(yayinci, durum, ilanlar[kod], bilgi, deneme=5)
    toplayici.durum_yaz(durum)


def suzgec_slug(s):
    tr = {"ç": "c", "Ç": "c", "ğ": "g", "Ğ": "g", "ı": "i", "İ": "i", "I": "i", "ö": "o", "Ö": "o", "ş": "s", "Ş": "s", "ü": "u", "Ü": "u",
          "â": "a", "Â": "a", "î": "i", "Î": "i", "û": "u", "Û": "u"}  # _uret.mjs ilanSlug ile aynı
    s = "".join(tr.get(c, c) for c in s).lower()
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", s))


def sinama():
    """Yayınlamadan Meta yolunu doğrular: yayınlanmamış FB fotoğrafı (silinir) + IG kapsayıcı FINISHED."""
    import yayinci
    gorsel = f"{SITE}/medya/ilan-a-1483.jpg"
    metin = "Sınama (yayınlanmayacak)"
    fb = yayinci.fb_foto(gorsel, metin, yayinla=False)
    print("FB yayınlanmamış foto:", "oluştu" if fb.get("id") else "YOK")
    sil = yayinci.fb_sil(fb["id"])
    print("FB sınama fotoğrafı silindi:", sil)
    kid = yayinci.ig_hazirla(gorsel, metin)
    print("IG kapsayıcı FINISHED (yayınlanmadı):", bool(kid))


if __name__ == "__main__":
    mod = sys.argv[1] if len(sys.argv) > 1 else "hazirlik"
    {"hazirlik": hazirlik, "yayinla": yayinla, "sinama": sinama}[mod]()
    # grup taraması (Mac) bayat ya da hatalıysa tur DÜŞMEZ (öteki kaynaklar çalışıyor); uyarı dosyası VPS
    # çalıştırıcısına bırakılır, o da günde en çok bir kez Telegram'a yazar (27.11.2026)
    uyari = os.environ.get("ILAN_GRUP_UYARI_DOSYA")
    if uyari:
        if toplayici.GRUP_HATASI:
            open(uyari, "w", encoding="utf-8").write(toplayici.GRUP_HATASI)
        elif os.path.exists(uyari):
            os.remove(uyari)
    if toplayici.EPOSTA_HATASI:  # öteki kaynaklar işlendi; e-posta kaynağı düştüyse tur hata verir (VPS bildirir)
        raise SystemExit("E-POSTA KAYNAĞI: " + toplayici.EPOSTA_HATASI)
