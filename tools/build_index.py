#!/usr/bin/env python3
"""Icerik dogrulama + katalog/arama dizini uretimi.

Kaynaklar (elle duzenlenir):
  app/src/main/assets/www/data/categories.json   -> kategori agaci ve "hazirlanacak" basliklar
  app/src/main/assets/www/data/topics/<id>.json  -> her konu bir dosya
  app/src/main/assets/www/data/daily.json        -> gunluk ifadeler
Uretilenler (elle DEGISTIRME):
  data/catalog.json  data/search.json

Hata varsa cikis kodu 1 ile biter; GitHub Actions bu yuzden bozuk icerikle APK uretmez.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "app/src/main/assets/www/data"
TOPICS = DATA / "topics"
LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]

errors, warnings = [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def load(p):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:  # noqa
        err(f"{p.name}: JSON okunamadi: {e}")
        return None


def walk(cats, parent=None):
    for c in cats:
        yield c, parent
        yield from walk(c.get("children", []), c["id"])


def count_examples(t):
    n = 0
    for u in t.get("uses", []):
        n += len(u.get("ex", []))
    for f in t.get("forms", []):
        n += len(f.get("ex", []))
    n += len(t.get("phrases", []))
    return n


def main():
    cats = load(DATA / "categories.json")
    if cats is None:
        return finish()
    cat_ids = {}
    for c, parent in walk(cats["categories"]):
        if c["id"] in cat_ids:
            err(f"categories: yinelenen kategori kimligi {c['id']}")
        cat_ids[c["id"]] = c
        c["topics"] = []

    topics = {}
    seen_sentences = {}
    for p in sorted(TOPICS.glob("*.json")):
        t = load(p)
        if t is None:
            continue
        tid = p.stem
        if t.get("id") != tid:
            err(f"{p.name}: 'id' alani dosya adiyla ayni olmali ('{tid}')")
        for k in ("tr", "en", "level", "cat", "short"):
            if not t.get(k):
                err(f"{p.name}: '{k}' alani eksik")
        if t.get("level") not in LEVELS:
            err(f"{p.name}: gecersiz seviye {t.get('level')}")
        if t.get("cat") not in cat_ids:
            err(f"{p.name}: bilinmeyen kategori {t.get('cat')}")
        if not t.get("explain") and not t.get("phrases"):
            err(f"{p.name}: 'explain' veya 'phrases' gerekli")
        if not t.get("advice"):
            err(f"{p.name}: 'advice' (ogretmen tavsiyesi) eksik")
        if not t.get("mistakes"):
            err(f"{p.name}: 'mistakes' eksik")
        if not t.get("ex") or len(t["ex"]) < 6:
            err(f"{p.name}: en az 6 alistirma gerekli")
        if t.get("cat") == "grammar-tenses" and count_examples(t) < 10:
            err(f"{p.name}: zaman konularinda en az 10 ornek cumle gerekli (var: {count_examples(t)})")
        elif t.get("cat", "").startswith("grammar") and count_examples(t) < 8:
            err(f"{p.name}: dil bilgisi konularinda en az 8 ornek gerekli (var: {count_examples(t)})")
        if t.get("phrases") is not None and len(t["phrases"]) < 6:
            err(f"{p.name}: kalip konularinda en az 6 kalip gerekli")
        for i, q in enumerate(t.get("ex", []), 1):
            tag = f"{p.name} alistirma {i}"
            if q.get("t") not in ("choice", "fill", "tr"):
                err(f"{tag}: gecersiz tur {q.get('t')}")
                continue
            if not q.get("q"):
                err(f"{tag}: soru metni bos")
            if q["t"] == "choice":
                o, a = q.get("o"), q.get("a")
                if not isinstance(o, list) or len(o) < 2 or not isinstance(a, int) or not (0 <= a < len(o)):
                    err(f"{tag}: 'o' liste ve 'a' gecerli indeks olmali")
                elif len(set(o)) != len(o):
                    err(f"{tag}: tekrarlayan secenek")
            else:
                if not isinstance(q.get("a"), list) or not q["a"] or not all(isinstance(x, str) and x for x in q["a"]):
                    err(f"{tag}: 'a' bos olmayan metin listesi olmali")
            if not q.get("e"):
                warn(f"{tag}: aciklama ('e') yok")
        for u in t.get("uses", []):
            for e in u.get("ex", []):
                seen_sentences.setdefault(e[0], set()).add(tid)
        for f in t.get("forms", []):
            for e in f.get("ex", []):
                if len(e) < 2 or not e[0] or not e[1]:
                    err(f"{p.name}: '{f.get('h')}' icinde eksik ornek/ceviri")
                seen_sentences.setdefault(e[0], set()).add(tid)
        for u in t.get("uses", []):
            for e in u.get("ex", []):
                if len(e) < 2 or not e[0] or not e[1]:
                    err(f"{p.name}: '{u.get('h')}' icinde eksik ornek/ceviri")
        for d in t.get("dialogs", []):
            for ln in d.get("l", []):
                if len(ln) != 3 or not all(ln):
                    err(f"{p.name}: diyalog satiri 3 alan olmali: {ln}")
        for m in t.get("mistakes", []):
            if len(m) != 3 or not all(m):
                err(f"{p.name}: 'mistakes' ogesi 3 alan olmali: {m}")
        topics[tid] = t

    for tid, t in topics.items():
        for r in t.get("related", []):
            if r not in topics:
                err(f"{tid}: related -> bilinmeyen konu {r}")
        for c in t.get("compare", []):
            if c[0] not in topics:
                err(f"{tid}: compare -> bilinmeyen konu {c[0]}")
    for s, ids in seen_sentences.items():
        if len(ids) > 1:
            warn(f"ayni ornek cumle birden fazla konuda: '{s}' -> {sorted(ids)}")

    # katalog
    order = sorted(topics.values(), key=lambda t: (t.get("o", 100), t["tr"]))
    for t in order:
        if t.get("cat") in cat_ids:
            cat_ids[t["cat"]]["topics"].append(t["id"])
    catalog = {
        "categories": cats["categories"],
        "topics": {t["id"]: {"tr": t["tr"], "en": t["en"], "level": t["level"], "cat": t["cat"], "short": t["short"]} for t in order},
    }

    # arama dizini
    items = []
    for t in order:
        ph = []

        def add(en, tr):
            if en:
                ph.append(f"{en} | {tr or ''}")

        for u in t.get("uses", []):
            for e in u.get("ex", []):
                add(e[0], e[1])
        for f in t.get("forms", []):
            for e in f.get("ex", []):
                add(e[0], e[1])
        for p_ in t.get("phrases", []):
            add(p_["en"], p_["tr"])
            if p_.get("ex"):
                add(p_["ex"][0], p_["ex"][1])
        for d in t.get("dialogs", []):
            for ln in d.get("l", []):
                add(ln[1], ln[2])
        for m in t.get("mistakes", []):
            add(m[1], m[0])
        tx = [t.get("why", "")] + t.get("explain", []) + [u.get("t", "") + " " + u.get("h", "") for u in t.get("uses", [])]
        tx += [p_.get("use", "") + " " + p_.get("note", "") for p_ in t.get("phrases", [])]
        tx += t.get("words", []) + [m[2] for m in t.get("mistakes", [])]
        terms = list(t.get("terms", [])) + list(t.get("tags", []))
        items.append({"id": t["id"], "tr": t["tr"], "en": t["en"], "level": t["level"], "cat": t["cat"],
                      "short": t["short"], "terms": terms, "ph": ph, "tx": " ".join(x for x in tx if x)})

    # gunluk ifadeler
    daily = load(DATA / "daily.json")
    if daily:
        for i, it in enumerate(daily.get("items", []), 1):
            if not it.get("en") or not it.get("tr"):
                err(f"daily.json: {i}. oge 'en' ve 'tr' gerektirir")
            if it.get("topic") and it["topic"] not in topics:
                err(f"daily.json: {i}. oge bilinmeyen konu {it['topic']}")
        if len(daily.get("items", [])) < 7:
            err("daily.json: en az 7 ifade gerekli")

    if errors:
        return finish()
    (DATA / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (DATA / "search.json").write_text(json.dumps({"items": items}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Tamam: {len(topics)} konu, {sum(len(i['ph']) for i in items)} aranabilir ifade, "
          f"{len(daily.get('items', [])) if daily else 0} gunluk ifade.")
    return finish()


def finish():
    for w in warnings:
        print("UYARI:", w)
    for e in errors:
        print("HATA:", e)
    if errors:
        print(f"{len(errors)} hata var; katalog uretilmedi.")
        sys.exit(1)


if __name__ == "__main__":
    main()
