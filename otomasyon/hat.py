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
import suzgec, toplayici  # noqa: E402

KOK = toplayici.KOK
ILANLAR = os.path.join(KOK, "veri", "ilanlar.json")
SITE = "https://ankaraisilani.com"


def calistir(cmd, **kw):
    return subprocess.run(cmd, cwd=KOK, check=True, **kw)


def git_yayinla(mesaj, yollar):
    calistir(["git", "config", "user.name", "ankara-is-ilani-hat"])
    calistir(["git", "config", "user.email", "hat@ankaraisilani.com"])
    calistir(["git", "add", "--"] + yollar)
    sonuc = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=KOK)
    if sonuc.returncode == 0:
        return False
    calistir(["git", "commit", "-q", "-m", mesaj])
    calistir(["git", "pull", "-q", "--rebase", "origin", "main"])
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
    adaylar = [k for k in kararlar if k["karar"] == "yayinla"]
    print(f"YAYIN: {len(adaylar)} yayına uygun ilan")
    for k in kararlar:
        print(f"  {k['zaman'][:10]} {k['platform']:9} {k['karar']:8} {k['gerekce']}")
    if not adaylar:
        git_yayinla("Hat: gelen kutusu kararları", ["veri/_hat_durumu.json"])  # beklet/reddet kararları kaybolmasın
        return
    veri = json.load(open(ILANLAR, encoding="utf-8"))
    son = max([int(re.sub(r"\D", "", i["kod"])) for i in veri["ilanlar"]] + [int(durum.get("son_kod", 0))])
    durum.setdefault("yayinlanan", {})
    bugun = datetime.now(toplayici.TR).strftime("%Y-%m-%d")
    yeni = []
    for k in adaylar:
        son += 1
        i = dict(k["ilan"])
        i.update({"kod": f"A-{son}", "aciklama": suzgec.aciklama_kur(k["ilan"]), "kaynak": "hat", "tarih": bugun})
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
    git_yayinla("Hat: " + ", ".join(i["kod"] for _, i in yeni) + " yayına alındı", yollar)
    for k, i in yeni:
        kod = i["kod"].lower()
        gorsel = f"{SITE}/medya/ilan-{kod}.jpg"
        ilan_adresi = f"{SITE}/ilan/{suzgec_slug(i['baslik'])}-{kod}"
        if not yayinci.url_bekle(gorsel) or not yayinci.url_bekle(ilan_adresi.replace("/ilan/", "/ilan/"), 40, 6):
            print(f"  ! {i['kod']}: site yayına çıkmadı, sosyal paylaşım ATLANDI")
            continue
        metin = yayinci.paylasim_metni(i, ilan_adresi)
        fb = yayinci.fb_foto(gorsel, metin)
        ig = yayinci.ig_yayinla(yayinci.ig_hazirla(gorsel, metin))
        durum["yayinlanan"][i["kod"]] = {"facebook": fb.get("link"), "instagram": ig.get("link"), "site": ilan_adresi,
                                          "zaman": datetime.now(toplayici.TR).isoformat(timespec="seconds"), "mesaj": k["id"]}
        print(f"  ✓ {i['kod']} → facebook={'var' if fb.get('link') else 'YOK'} instagram={'var' if ig.get('link') else 'YOK'}")
        toplayici.durum_yaz(durum)
    git_yayinla("Hat: yayın kayıtları", ["veri/_hat_durumu.json"])


def suzgec_slug(s):
    tr = {"ç": "c", "Ç": "c", "ğ": "g", "Ğ": "g", "ı": "i", "İ": "i", "I": "i", "ö": "o", "Ö": "o", "ş": "s", "Ş": "s", "ü": "u", "Ü": "u"}
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
