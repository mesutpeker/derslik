# 🏫 Karaman MTAL — Ders ve Öğretmen Takip Sistemi

**Karaman Mesleki ve Teknik Anadolu Lisesi** 2026-2027 Öğretim Yılı (12/10/2026) Haftalık Ders Programı, Nöbet ve Öğretmen Takip Portalı.

Bu uygulama; gün, ders saati ve sınıf kriterlerine göre öğretmenlerin hangi sınıfta ve atölyede derste olduğunu, boşta olan öğretmenleri ve birleşik sınıfların durumunu anlık olarak gösteren mobil öncelikli, kompakt bir web uygulamasıdır.

---

## 🚀 Özellikler

* **📱 Mobil Öncelikli & Kompakt Tasarım:** Küçük ekranlarda tek parmakla rahat kullanım için optimize edilmiş 3 açılır menü (Gün, Ders Saati, Sınıf).
* **⚡ Anlık Sorgulama:** 
  * 72 Öğretmen, 43 Sınıf (ve dal şubeleri), 1.400+ ders saati.
  * O saatte derste olan tüm öğretmenleri, sınıflarını ve atölyelerini listeler.
* **⚠️ Akıllı Birleşik Sınıf Uyarıları:**
  * `10A-D`, `10B-G`, `11C-D` gibi birleşik sınıflar seçildiğinde, o gün kültür dersi günüyse veya seçilen saat boşsa anında bilgilendirme yapar.
  * Tek tıkla ilgili ana şubelere (`👉 10-A Sınıfına Bak`, `👉 10-D Sınıfına Bak`) geçiş butonları sunar.
* **🕒 Otomatik "Şu An" Butonu:** Cihazınızın sistem saatine göre bugünün gün ve ders saatini tek tıkla algılar.
* **📖 Kapsamlı Dokümantasyon:** Tüm öğretmen ve ders kısaltmalarının detaylı açıklamalarını içeren [`DERS_VE_OGRETMEN_KISALTMALARI.md`](DERS_VE_OGRETMEN_KISALTMALARI.md) kılavuzu.
* **📦 Sıfır Bağımlılık & Çevrimdışı Çalışma:** Tek bir HTML dosyasında gömülü veriyle sunucu veya internet gerektirmeden çalışır.

---

## 🌐 Canlı Yayın (GitHub Pages)

Uygulamayı doğrudan web tarayıcınızda açmak için:  
👉 **[https://mesutpeker.github.io/derslik/](https://mesutpeker.github.io/derslik/)**

---

## 📂 Dosya Yapısı

* `index.html` — Mobil uyumlu, kendi kendine yeten interaktif web uygulaması
* `okul_verisi.json` — Yapılandırılmış JSON veri tabanı
* `DERS_VE_OGRETMEN_KISALTMALARI.md` — 72 öğretmen ve 181 ders kodunun detaylı fihristi
* `README.md` — Proje tanıtım ve kullanım kılavuzu

---

### Kurum Bilgisi
* **Kurum:** T.C. KARAMAN VALİLİĞİ — Karaman Mesleki ve Teknik Anadolu Lisesi
* **Okul Müdürü:** Nebi SARI
* **Program Tarihi:** 12/10/2026
