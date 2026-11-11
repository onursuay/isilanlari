#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ankara İş İlanı — yayıncı: Facebook sayfası + Instagram (organik paylaşım, REKLAM DEĞİL).

Her yayın geri okunur (permalink / durum); "gönderildi" ≠ "yayında". Jeton yalnız ortam değişkeninden
(META_SAYFA_TOKEN, yalnız sayfa jetonu) okunur ve hiçbir yere yazdırılmaz.
Bulutta (GitHub Actions) çalışır; yerel Claude oturumunun reklam kapısı bu dosyayı çalıştırmaz.
"""
import json, os, re, time, urllib.parse, urllib.request

SAYFA_ID = "106370611224653"
IG_ID = "17841449612901396"
SURUM = "v21.0"
SITE = "https://ankaraisilani.com"


def _jeton():
    t = os.environ.get("META_SAYFA_TOKEN", "").strip()
    if not t:
        raise SystemExit("META_SAYFA_TOKEN yok")
    return t


def _graph(yol, alanlar=None, yontem="GET"):
    alanlar = dict(alanlar or {})
    alanlar["access_token"] = _jeton()
    adres = f"https://graph.facebook.com/{SURUM}/{yol}"
    try:
        if yontem == "GET":
            return json.load(urllib.request.urlopen(adres + "?" + urllib.parse.urlencode(alanlar)))
        istek = urllib.request.Request(adres, urllib.parse.urlencode(alanlar).encode(), method=yontem)
        return json.load(urllib.request.urlopen(istek))
    except urllib.error.HTTPError as e:
        govde = e.read().decode("utf-8", "ignore")
        try:
            h = json.loads(govde).get("error", {})
            raise RuntimeError(f"Graph {yontem} {yol}: {h.get('code')}/{h.get('error_subcode')} {h.get('message')}")
        except ValueError:
            raise RuntimeError(f"Graph {yontem} {yol}: HTTP {e.code}")


def url_bekle(adres, deneme=40, aralik=6):
    """Görselin sitede yayında (HTTP 200, jpeg) olmasını bekler."""
    for _ in range(deneme):
        try:
            r = urllib.request.urlopen(adres)
            if r.status == 200 and "image" in (r.headers.get("Content-Type") or ""):
                return True
        except Exception:
            pass
        time.sleep(aralik)
    return False


def paylasim_metni(i, ilan_adresi):
    """Facebook/Instagram metni. Telefon, e-posta ve işveren adı YOK; iş vaadi YOK."""
    yer = f"{i['ilce']}" + (f" ({i['semt']})" if i.get("semt") and i["semt"] != i["ilce"] else "")
    satirlar = [f"{i['baslik']} · {yer}", "", i["aciklama"], "",
                f"• Çalışma: {i['calisma']}" + (f" · {i['vardiya']}" if i.get("vardiya") else "")]
    if i.get("ucret"):
        satirlar.append(f"• Ücret: {i['ucret']}")
    satirlar += ["", f"Başvuru ve ayrıntılar: {ilan_adresi}", "",
                 f"Ankara'da eleman arıyorsanız ilanınızı ücretsiz yayınlayalım: {SITE}/ilan-ver", ""]
    etiketler = ["#ankaraişilanı", "#ankara", "#işilanı", "#elemanaranıyor", "#işarayanlar",
                 "#" + re.sub(r"\s+", "", i["ilce"].lower().replace("İ", "i").replace("I", "ı")) + "işilanları"]
    return "\n".join(satirlar) + " ".join(etiketler)


def fb_foto(gorsel_url, metin, yayinla=True):
    """Facebook sayfasına fotoğraflı gönderi. yayinla=False → yalnız yöneticilerin gördüğü yayınlanmamış gönderi (sınama)."""
    r = _graph(f"{SAYFA_ID}/photos", {"url": gorsel_url, "caption": metin, "published": "true" if yayinla else "false"}, "POST")
    foto_id = r.get("id")
    okuma = _graph(foto_id, {"fields": "id,link,created_time,page_story_id"})
    return {"id": foto_id, "link": okuma.get("link"), "gonderi": okuma.get("page_story_id")}


def fb_sil(nesne_id):
    return _graph(nesne_id, {}, "DELETE")


def ig_hazirla(gorsel_url, metin, bekle_sn=90):
    """Instagram medya kapsayıcısı oluşturur ve FINISHED olana kadar bekler (yayınlamaz)."""
    k = _graph(f"{IG_ID}/media", {"image_url": gorsel_url, "caption": metin}, "POST")
    for _ in range(bekle_sn // 4):
        d = _graph(k["id"], {"fields": "status_code"})
        if d.get("status_code") == "FINISHED":
            return k["id"]
        if d.get("status_code") in ("ERROR", "EXPIRED"):
            raise RuntimeError("Instagram kapsayıcı hatası: " + str(d))
        time.sleep(4)
    raise RuntimeError("Instagram kapsayıcı zaman aşımı")


def ig_yayinla(kapsayici_id):
    s = _graph(f"{IG_ID}/media_publish", {"creation_id": kapsayici_id}, "POST")
    okuma = _graph(s["id"], {"fields": "id,permalink,timestamp"})
    return {"id": s["id"], "link": okuma.get("permalink")}
