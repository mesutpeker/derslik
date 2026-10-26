"""Generate the human-readable directory and complete assignment table."""
from collections import Counter
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def build():
    data = json.loads((ROOT / "okul_verisi.json").read_text(encoding="utf-8"))
    names = {t["id"]: t["name"] for t in data["teachers"]}
    lines = ["# PDF’den Çıkarılan Öğretmen ve Ders Kodu Dizini", "",
             "Bu dosya okul_verisi.json verisinden üretilir. Eski sürümdeki doğrulanmamış uzun ders adlarının yerini kaynak PDF’deki ham kodlar almıştır.", "",
             "72 öğretmen, 45 sınıf/grup, 181 ders kodu, 1.347 öğretmen ataması, 1.264 ayrı ders, 83 ortak ders ve 87 MESEM ataması vardır.", "",
             "`T001` gibi kimlikler uygulamanın dahili kimlikleridir; PDF’de öğretmen kısaltması olarak yazmazlar. Sayfa/satır konumları her sayfada başlığın altındaki ilk öğretmenden başlayarak sayılır.", "",
             "## Öğretmenler ve günlük ders saati toplamları", "",
             "| Kimlik | Öğretmen | Pzt | Salı | Çar | Per | Cuma | Toplam | PDF sayfa/satır |",
             "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |"]
    for teacher in data["teachers"]:
        counts = Counter(a["d"] for a in data["assignments"] if a["teacher_id"] == teacher["id"])
        counts_text = " | ".join(str(counts[day]) for day in data["days"])
        lines.append(f"| {teacher['id']} | {teacher['name']} | {counts_text} | {teacher['total_hours']} | {teacher['source_page']}/{teacher['source_row']} |")
    lines += ["", "MEHMET KORKMAZ’ın kaynak PDF’deki satırı boştur. İki MAT10 hücresinde derslik yazmaz: DUYGU YÜNGEVİŞ, Salı 5–6. saat, 10-E. Bu alanlar doldurulmamıştır.", "",
              "## Sınıf/grup kodları", "", "| Kod | Ayrı ders saati | Öğretmen ataması |", "| --- | ---: | ---: |"]
    for cls in data["classes"]:
        lines.append(f"| {cls} | {sum(l['c'] == cls for l in data['lessons'])} | {sum(a['c'] == cls for a in data['assignments'])} |")
    lines += ["", "Bu tablo ham PDF kodlarını gösterir. Arayüzde yalnızca 9, 10, 11 ve 12. sınıf düzeyi seçilir; eski sürümdeki şube ilişkilerine göre ortak kültür dersleri ayrı şube kartlarında aynı öğretmenle gösterilir. Ham kaynak kayıtları değişmez.", "",
              "## Ders kodları", "", "PDF uzun ders adlarını içermediği için bu dizin kodları açımlamaz. Kodlar yazıldıkları şekilde korunur; örneğin `SBKMR1` ve `GKOKA1` sonlarına tahmini karakter eklenmez.", "",
              "| Ders kodu | Ayrı ders saati | Öğretmen ataması |", "| --- | ---: | ---: |"]
    for code in data["course_catalog"]:
        lines.append(f"| {code} | {sum(l['l'] == code for l in data['lessons'])} | {sum(a['l'] == code for a in data['assignments'])} |")
    lines += ["", "## Ders başlama ve bitiş saatleri", "", "| Saat | Pazartesi–Perşembe | Cuma |", "| --- | --- | --- |"]
    for standard, friday in zip(data["period_times"]["Pazartesi"], data["period_times"]["Cuma"]):
        lines.append(f"| {standard['period']} | {standard['start']} – {standard['end']} | {friday['start']} – {friday['end']} |")
    lines += ["", f"Kaynak PDF SHA-256: `{data['source']['sha256']}`", ""]
    (ROOT / "DERS_VE_OGRETMEN_KISALTMALARI.md").write_text("\n".join(lines), encoding="utf-8")
    records = ["# PDF’den Çıkarılan Bütün Öğretmen Atamaları", "",
               "Her satır kaynak PDF’deki bir dolu öğretmen–ders saati hücresidir. Ortak derslerin her öğretmeni ayrı satırdadır. PDF konumu sayfa/satır/sütun olarak verilir; sütunlar Pazartesi 1. dersten Cuma 10. derse kadar 1–50 sayılır.", "",
               "| Öğretmen | Gün | Saat | Sınıf/grup | Ders kodu | Derslik | PDF konumu |", "| --- | --- | ---: | --- | --- | --- | --- |"]
    for a in data["assignments"]:
        source = a["source"]
        records.append(f"| {names[a['teacher_id']]} | {a['d']} | {a['p']} | {a['c']} | {a['l']} | {a['r'] or 'Belirtilmemiş'} | {source['page']}/{source['row']}/{source['column']} |")
    records += ["", f"Toplam: {len(data['assignments'])} atama. Kaynak SHA-256: `{data['source']['sha256']}`", ""]
    (ROOT / "PROGRAM_KAYITLARI.md").write_text("\n".join(records), encoding="utf-8")
    print("Generated teacher/code directory and all 1,347 assignments")


if __name__ == "__main__":
    build()
