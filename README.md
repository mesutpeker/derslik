# Karaman MTAL — Ders ve Öğretmen Takip

Verilen dört sayfalık öğretmen çarşaf programından yeniden üretilmiş haftalık ders uygulaması.

- 72 öğretmen, 45 sınıf/grup, 181 ders kodu.
- 1.347 öğretmen ataması, 1.264 ayrı ders; 83 derste iki öğretmen birlikte yer alır.
- 87 MESEM ataması eksiksiz korunur. Kaynak PDF’deki iki boş derslik tahmin edilmez.
- Gün, saat, **yalnızca 9, 10, 11, 12. sınıf düzeyi** ve öğretmen filtreleri.
- Mobilde 60 px yüksekliğinde, en az 17 px yazılı açılır menüler. Sınıf ve öğretmen kartın ana bilgileri; derslik büyük ve belirgin, saat/ders kodu ikincil boyuttadır. Açıklama blokları ve PDF sayfa/satır etiketleri gösterilmez.
- Ortak kültür dersleri 10-A ve 10-D gibi ayrı şube kartlarında aynı öğretmenle gösterilir. Birleşik grup kodları menüde yer almaz; meslek/atölye dersleri ilgili şubenin kartına taşınır.
- Türkiye saat dilimine göre ders içi, ders arası, ders öncesi/sonrası ve hafta sonu ayrımı.
- CSS, JavaScript ve veri `index.html` içinde gömülüdür. CDN, harici font, sunucu veya çalışma zamanı kurulumu gerekmez. HTML dosyasını tarayıcıda açabilirsiniz.

## Verinin sınırları

Uygulama planlanan haftalık programı gösterir. PDF’de bulunmayan tarih, öğretim yılı, branş veya uzun ders adı eklenmez. Ham sınıf/grup kodları kaynak veride korunur. Görünümde önceki sürümün şube ilişkileri kullanılır; ortak kültür dersleri ayrı şubelerde gösterilse de aynı kaynak dersi ve öğretmen atamalarına bağlıdır. Öğretmen satırı boşsa ders ataması üretilmez.

## Sınıf görünümü

Menüde yalnızca **9, 10, 11 ve 12** vardır. Seçilen düzeyin normal şubeleri ve MESEM sınıfları ayrı kartlarda gösterilir. Örneğin Çarşamba / 6. ders / 10. sınıf seçiminde hem **10-A** hem **10-D**, **KİM10 / SALİH KILIÇ** gösterir.

| Ortak kültür şubeleri | Atölye grup kodunun gösterildiği şube |
| --- | --- |
| 10-A / 10-D | 10A-D → 10-D |
| 10-B / 10-G | 10B-G → 10-G |
| 11-B / 11-G | 11B-G → 11-G |
| 11-C / 11-D | 11C-D → 11-D |
| 12-A / 12-E | 12A-E → 12-E |
| 12-B / 12-G | 12B-G → 12-G |
| 12-C / 12-D | 12C-D → 12-D |

Tesisat grupları (9C-İ, 10C-İ, 11C-İ, 12C-İ) kendi C şubelerinde grup notuyla gösterilir. 11-A1 ve 11-A2 ayrı şubeler olarak korunur. Kültür dersi kod listeleri `app-core.js` içinde açıkça tanımlıdır; meslek dersleri kültür dersi gibi diğer şubeye kopyalanmaz. Kısa sonuç sayacı gösterilen şube kartlarının sayısını gösterir. 1.264 kaynak ders, 1.403 şube kartı olarak gösterilir; 41 farklı şube/MESEM sınıfı vardır. Öğretmenin haftalık toplamı kaynak atamalardan hesaplanır.

Önceki JSON şeması yerine `schema_version: 2` kullanılır. `assignments` kaynak hücreleri, `lessons` aynı dersi birlikte veren öğretmenleri içerir. Her atamada kaynak sayfa, öğretmen satırı, ders sütunu ve hücre koordinatları saklanır. JSON verinin tek kaynağıdır; HTML bu dosyadan üretilir.

## Dosyalar

| Dosya | Amaç |
| --- | --- |
| `index.html` | Tek başına çalışan uygulama |
| `okul_verisi.json` | PDF’den çıkarılan asıl veri |
| `app-core.js` / `app-ui.js` | Uygulama mantığı ve arayüz kaynağı |
| `styles.css` / `template.html` | Çevrimdışı görünüm ve HTML şablonu |
| `PROGRAM_KAYITLARI.md` | 1.347 atamanın okunabilir tam dökümü |
| `DERS_VE_OGRETMEN_KISALTMALARI.md` | Öğretmen toplamları, sınıf ve ham ders kodları dizini |
| `scripts/extract_pdf.py` | Koordinatlar ve çizilmiş tablo üzerinden veri çıkarımı |
| `scripts/verify_pdf.py` | pypdf ham komutları/font tablolarıyla bağımsız doğrulama |
| `tests/` | Tekrarlanabilir testler, PDF referansı ve sonuçlar |

## Yeniden üretme ve test

Uygulamanın kullanımı için kurulum gerekmez. Aşağıdaki komutlar geliştirici/veri doğrulama akışıdır; Python 3 ve Node.js gerektirir. PDF kitaplıkları `requirements.txt` dosyasında listelenir.

```sh
python3 -m pip install -r requirements.txt
python3 scripts/extract_pdf.py "/tam/yol/Çarşaf El Programları.pdf"
python3 scripts/verify_pdf.py "/tam/yol/Çarşaf El Programları.pdf"
python3 scripts/build_app.py
python3 scripts/build_reference.py
python3 tests/test_extraction.py "/tam/yol/Çarşaf El Programları.pdf"
node tests/test_app.cjs
```

Çıkarıcı bu PDF’nin dört sayfalık, 50 ders sütunlu düzenine göre hazırlanmıştır. Beklenmeyen bir sayfa/tablo düzeninde sessizce tahmin yapmak yerine hata verir. Testleri Python’un `-O` seçeneği olmadan çalıştırın.

`tests/pdf-reference.json`, uygulama verisinden kopyalanmaz: bağımsız pypdf çözücüsünün doğrudan PDF’den okuduğu referanstır. Şube eşleştirmelerinin test sözleşmesi ayrıca `tests/class-view-reference.json` içinde bulunur. Testler 3.600 dolu/boş hücreyi, 24.090 gün/saat/düzey/öğretmen birleşimini, 1.403 şube kartının kaynak bağlantısını, 139 ortak kültür çiftini, haftanın 10.080 dakikasını, 5.082 arayüz birleşimini ve kasıtlı bozulmuş veri örneklerini denetler.

`tests/mobile-preview.html` ve `tests/mobile-preview-320.html` sırasıyla 390 ve 320 piksel genişliğinde görsel kontrol içindir. Kaynak veriyi değiştirmez. Test sonuçları ilgili `*-verification.json` dosyalarındadır.

## Canlı yayın

[Uygulamayı aç](https://mesutpeker.com/derslik/) · [GitHub deposu](https://github.com/mesutpeker/derslik)

GitHub Pages, `main` dalının kök dizininden yayınlanır. Mevcut HTTPS ve alan adı ayarları kullanılır.
