# İngilizce Kütüphanem — Sürüm 0.1

Çevrim dışı çalışan Android uygulaması. Kabuk: Kotlin + WebView. İçerik: JSON dosyaları.
Android Studio gerekmez; APK'yı GitHub Actions derler.

## APK nasıl alınır (Windows 10, kurulum yok)
1. github.com'da yeni bir depo (repository) aç. Bu proje için **ayrı ve boş** bir depo kullan.
2. Bu ZIP'i bilgisayarında aç. İçindeki **tüm dosya ve klasörleri** deponun köküne yükle
   (Add file → Upload files; klasörleri sürükle-bırak yap). `.github` klasörü gizli sayılabilir;
   Dosya Gezgini → Görünüm → "Gizli öğeler" kutusunu işaretle.
3. Deponun kökünde şu yapı görünmeli: `.github/workflows/build.yml`, `app/`, `tools/`, `settings.gradle.kts`.
   (Önceki projelerindeki gibi dosyaları `.github/workflows` altına koyma; bu projede gerekmez.)
4. Actions sekmesi → "APK derle" → Run workflow. Yeşil tik çıkana kadar bekle (ilk derleme birkaç dakika sürer).
5. Çalışmanın sayfasının altındaki **Artifacts** bölümünden `IngilizceKutuphane-debug-apk` dosyasını indir,
   ZIP'ten çıkar, `app-debug.apk` dosyasını telefonuna at ve yükle ("bilinmeyen kaynaklardan yükleme"ye izin ver).
6. Kırmızı çarpı çıkarsa çalışmayı aç, hata satırlarını kopyalayıp bana gönder; gizlemeden düzeltiriz.

## Yeni konu ekleme
- `app/src/main/assets/www/data/topics/` içine `konu-kimligi.json` ekle (mevcut bir konuyu örnek al).
- Kategoriyi `data/categories.json` içinden seç; "planned" listesindeki başlık yazılınca oradan sil.
- `python tools/build_index.py` katalog ve arama dizinini yeniden üretir ve içerik hatalarını listeler.
  (Python kurmak istemezsen gerek yok: GitHub Actions bunu her derlemede kendisi çalıştırır, hata varsa APK üretmez.)

## Konu dosyası alanları
id, tr, en, level (A1–C2), cat, o (sıra), short, terms (arama eş anlamlıları), why, explain[], formulas[[etiket, kalıp]],
uses[{h,t,ex[[en,tr,not]]}], forms[{h,ex}], words[], phrases[{en,tr,use,reg,ex,note}], dialogs[{h,l[[kişi,en,tr]]}],
compare[[konu-id, metin]], mistakes[[yanlış, doğru, neden]], ex[{t: choice|fill|tr, q, o, a, e}], advice, related[].

## Sınırlar
- Sesli okuma yalnızca cihazda İngilizce (ABD) TTS motoru hazırsa görünür.
- Veriler yalnızca cihazda (WebView yerel depolaması) saklanır; uygulamayı silersen ilerleme de silinir.
