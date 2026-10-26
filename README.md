# Karaman MTAL — Ders ve Öğretmen Takip

Verilen dört sayfalık öğretmen çarşaf programından yeniden üretilmiş haftalık ders uygulaması.

- 72 öğretmen, 45 sınıf/grup, 181 ders kodu.
- 1.347 öğretmen ataması, 1.264 ayrı ders; 83 derste iki öğretmen birlikte yer alır.
- 87 MESEM ataması eksiksiz korunur. Kaynak PDF’deki iki boş derslik tahmin edilmez.
- Gün, saat, sınıf/grup ve öğretmen filtreleri; ortak derslerde tüm öğretmenler.
- Türkiye saat dilimine göre ders içi, ders arası, ders öncesi/sonrası ve hafta sonu ayrımı.
- CSS, JavaScript ve veri `index.html` içinde gömülüdür. CDN, harici font, sunucu veya çalışma zamanı kurulumu gerekmez. HTML dosyasını tarayıcıda açabilirsiniz.

## Verinin sınırları

Uygulama planlanan haftalık programı gösterir. PDF’de bulunmayan tarih, öğretim yılı, branş veya uzun ders adı eklenmez. Sınıf/grup kodları kaynakta yazıldıkları şekilde ayrı tutulur; birleşik kodlardan başka sınıflara ders kopyalanmaz. Öğretmen satırı boşsa ders ataması üretilmez.

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

`tests/pdf-reference.json`, uygulama verisinden kopyalanmaz: bağımsız pypdf çözücüsünün doğrudan PDF’den okuduğu referanstır. Testler 3.600 dolu/boş hücreyi, 221.628 filtre birleşimini, haftanın 10.080 dakikasını, 7.788 arayüz birleşimini ve kasıtlı bozulmuş veri örneklerini denetler.

`tests/mobile-preview.html` 390 piksel genişliğinde görsel kontrol içindir. Kaynak veriyi değiştirmez. Test sonuçları ilgili `*-verification.json` dosyalarındadır.

## Canlı yayın

[Uygulamayı aç](https://mesutpeker.com/derslik/) · [GitHub deposu](https://github.com/mesutpeker/derslik)

GitHub Pages, `main` dalının kök dizininden yayınlanır. Mevcut HTTPS ve alan adı ayarları kullanılır.
