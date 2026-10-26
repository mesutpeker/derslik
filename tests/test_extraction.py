"""Regression and fault-injection checks against the actual source PDF.

Usage: python3 tests/test_extraction.py /path/to/source.pdf
"""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


pdf = Path(sys.argv[1])
extractor = load("extract_pdf")
verifier = load("verify_pdf")
data = json.loads((ROOT / "okul_verisi.json").read_text(encoding="utf-8"))
assert extractor.extract(pdf) == data, "Extraction is not reproducible"
teachers = {t["id"]: t["name"] for t in data["teachers"]}


def find(name, day, period):
    return next(a for a in data["assignments"] if teachers[a["teacher_id"]] == name
                and a["d"] == day and a["p"] == period)


# Literal spot checks transcribed from the rendered four-page source.
fixtures = [
    ("NEBİ SARI", "Perşembe", 4, "11-B", "SBKMR1", "MOB2"),
    ("OKTAY ADACIK", "Perşembe", 1, "11-B", "SMMİ11", "MOB3"),
    ("NESİBE GÜZİDE ÜNAL", "Salı", 1, "12MSMC", "ÇOP12", "19"),
    ("DERYA TOPTAŞ", "Pazartesi", 1, "10-F", "BDD10", "E1"),
    ("FEHMİ ALPARSLAN DEMİR", "Çarşamba", 1, "10A-D", "OTRS10", "MOT2"),
    ("AHMET ÜSTBAŞ", "Çarşamba", 1, "9-A", "TİİŞ9", "MK1"),
    ("ÜMİT ŞEN", "Çarşamba", 10, "9-D", "TOTEK9", "MOT3"),
    ("RIFAT CANUYLASI", "Salı", 1, "11-A1", "BTY", "13"),
    ("BURAK KAÇAR", "Salı", 1, "9-C", "TAR 9", "10"),
    ("AYŞE GİRGİN", "Salı", 7, "10-E", "TAR10", "16"),
    ("DUYGU YÜNGEVİŞ", "Salı", 5, "10-E", "MAT10", ""),
    ("FEYZAN GEVREK", "Pazartesi", 1, "11-E", "FELS11", "18"),
    ("BAHADIR METE", "Cuma", 10, "9-L", "BED 9", "S1"),
]
for name, day, period, cls, course, room in fixtures:
    assignment = find(name, day, period)
    assert (assignment["c"], assignment["l"], assignment["r"]) == (cls, course, room)

mutations = {}
bad = copy.deepcopy(data); bad["assignments"][0]["teacher_id"] = "T035"; mutations["wrong_teacher"] = bad
for field, value in (("d", "Pazartesi"), ("p", 10), ("c", "12-L"), ("l", "TAR10"), ("r", "99")):
    bad = copy.deepcopy(data); bad["assignments"][0][field] = value; mutations[f"wrong_{field}"] = bad
bad = copy.deepcopy(data); bad["assignments"].pop(); mutations["missing_assignment"] = bad
bad = copy.deepcopy(data); bad["assignments"].append(copy.deepcopy(bad["assignments"][0])); mutations["duplicate_assignment"] = bad
bad = copy.deepcopy(data); bad["assignments"][0]["p"] = 1; bad["assignments"][0]["d"] = "Pazartesi"; bad["assignments"][0]["teacher_id"] = "T035"; mutations["invented_empty_period"] = bad
bad = copy.deepcopy(data); bad["assignments"] = [a for a in bad["assignments"] if "MSM" not in a["c"]]; mutations["missing_mesem"] = bad
bad = copy.deepcopy(data); shared = next(l for l in bad["lessons"] if len(l["teacher_ids"]) == 2); shared["teacher_ids"].pop(); shared["assignment_ids"].pop(); mutations["lost_shared_teacher"] = bad
bad = copy.deepcopy(data); next(a for a in bad["assignments"] if not a["r"])["r"] = "01"; mutations["guessed_unspecified_room"] = bad
bad = copy.deepcopy(data); bad["period_times"]["Cuma"][5]["start"] = "13:20"; mutations["wrong_friday_time"] = bad
bad = copy.deepcopy(data); bad["teachers"][0]["total_hours"] = 100; mutations["wrong_teacher_hours"] = bad
bad = copy.deepcopy(data); bad["classes"].pop(); mutations["missing_class_option"] = bad
bad = copy.deepcopy(data); bad["course_catalog"].pop(); mutations["missing_course_code"] = bad
bad = copy.deepcopy(data); bad["teachers"][0]["source_row"] = 99; mutations["wrong_source_row"] = bad
bad = copy.deepcopy(data); bad["source"]["sha256"] = "0" * 64; mutations["wrong_source_pdf"] = bad
bad = copy.deepcopy(data); bad["assignments"][0]["source"]["column"] = 1; mutations["wrong_source_column"] = bad
bad = copy.deepcopy(data); bad["assignments"][0]["source"]["bbox"][0] = 0; mutations["wrong_source_bbox"] = bad

rejected = []
with tempfile.TemporaryDirectory(prefix="derslik-validation-") as temporary:
    candidate = Path(temporary) / "mutated.json"
    for name, bad in mutations.items():
        candidate.write_text(json.dumps(bad, ensure_ascii=False), encoding="utf-8")
        try:
            verifier.verify(pdf, candidate)
        except (AssertionError, KeyError):
            rejected.append(name)
        else:
            raise AssertionError(f"Verifier accepted corrupt data: {name}")
result = {"passed": True, "reproducible_extraction": True, "visual_regression_fixtures": len(fixtures),
          "deliberately_corrupted_datasets_rejected": len(rejected), "rejected_cases": rejected}
(ROOT / "tests/extraction-verification.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, ensure_ascii=False))
