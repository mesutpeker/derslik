"""Independent verifier: decode raw PDF operators with pypdf, without pdfminer.

This deliberately does not import the extraction/build code. It reads font CMaps,
glyph widths, BT/Td/Tf/Tj operators, and checks all 3,600 teacher-period cells.
Usage: python3 scripts/verify_pdf.py source.pdf [--data okul_verisi.json]
"""
import argparse
from collections import defaultdict, Counter
import hashlib
import json
import re
from pathlib import Path
from pypdf import PdfReader
from pypdf.generic import ContentStream

ROOT = Path(__file__).resolve().parents[1]
DAYS = ("Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma")


def font_tables(font):
    font = font.get_object()
    cmap = font["/ToUnicode"].get_data().decode("ascii")
    assert "beginbfchar" not in cmap and "[" not in cmap, "Unsupported CMap"
    chars = {}
    for block in re.findall(r"beginbfrange(.*?)endbfrange", cmap, re.S):
        for first, last, unicode in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block):
            for code in range(int(first, 16), int(last, 16) + 1):
                chars[code] = chr(int(unicode, 16) + code - int(first, 16))
    descendant = font["/DescendantFonts"][0].get_object()
    widths, sequence = {}, descendant["/W"]
    i = 0
    while i < len(sequence):
        first, value = int(sequence[i]), sequence[i + 1]
        if isinstance(value, list):
            widths.update({first + j: float(width) for j, width in enumerate(value)})
            i += 2
        else:
            last, width = int(value), float(sequence[i + 2])
            widths.update({code: width for code in range(first, last + 1)})
            i += 3
    return chars, widths


def independent_extract(path):
    reader = PdfReader(path)
    cells, teacher_positions, source_times = {}, {}, {}
    raw_runs = 0
    for page_index, page in enumerate(reader.pages):
        fonts = {str(name): font_tables(font) for name, font in page["/Resources"]["/Font"].items()}
        names, fields, times = defaultdict(list), defaultdict(dict), defaultdict(dict)
        font_name, font_size, x, y = None, None, 0, 0
        stack = []
        for args, operator in ContentStream(page.get_contents(), reader).operations:
            if operator == b"q":
                stack.append((font_name, font_size))
            elif operator == b"Q":
                font_name, font_size = stack.pop()
            elif operator == b"BT":
                x = y = 0
            elif operator == b"Tf":
                font_name, font_size = str(args[0]), float(args[1])
            elif operator == b"Td":
                x += float(args[0]); y += float(args[1])
            elif operator == b"Tj":
                raw = args[0].original_bytes if hasattr(args[0], "original_bytes") else bytes(args[0])
                assert len(raw) % 2 == 0
                codes = [int.from_bytes(raw[i:i + 2], "big") for i in range(0, len(raw), 2)]
                chars, widths = fonts[font_name]
                text = "".join(chars[code] for code in codes)
                width = sum(widths[code] for code in codes) * font_size / 1000
                center = x + width / 2
                top = 792 - y
                if font_size == 7 and ":" in text:
                    col = int((center - 69.63) // 18)
                    if 0 <= col < 50 and 95 < top < 118:
                        times[col]["start" if top < 110 else "end"] = text
                if 118 < top < (388 if page_index == 3 else 748):
                    row = int((top - 117.53) // 30)
                    if font_size == 6.5 and x < 69:
                        names[row].append((top, text))
                    elif font_size == 5:
                        col = int((center - 69.63) // 18)
                        field = round((top - 124.1 - row * 30) / 10)
                        assert field not in fields[(row, col)]
                        fields[(row, col)][field] = text
                        raw_runs += 1
                x += width
            elif operator in (b"TJ", b"Tm", b"TD", b"T*", b"cm"):
                raise AssertionError(f"Unsupported positioning operator: {operator}")
        for row, parts in names.items():
            name = " ".join(text for _, text in sorted(parts))
            teacher_positions[(page_index + 1, row + 1)] = name
            for col in range(50):
                value = fields.get((row, col), {})
                if value:
                    assert set(value) in ({0, 1}, {0, 1, 2})
                    cells[(name, DAYS[col // 10], col % 10 + 1)] = (value[1], value[0], value.get(2, ""))
        decoded_times = {day: [{"period": period + 1, **times[day_index * 10 + period]}
                               for period in range(10)] for day_index, day in enumerate(DAYS)}
        assert all(len(item) == 3 for slots in decoded_times.values() for item in slots)
        if source_times:
            assert source_times == decoded_times
        source_times = decoded_times
    return cells, teacher_positions, source_times, raw_runs


def verify(pdf, data_path):
    data = json.loads(data_path.read_text(encoding="utf-8"))
    cells, positions, times, raw_runs = independent_extract(pdf)
    assert hashlib.sha256(pdf.read_bytes()).hexdigest() == data["source"]["sha256"]
    assert times == data["period_times"], "Bell times differ"
    teacher_names = {t["id"]: t["name"] for t in data["teachers"]}
    teacher_positions = {t["id"]: (t["source_page"], t["source_row"]) for t in data["teachers"]}
    assert {(t["source_page"], t["source_row"]): t["name"] for t in data["teachers"]} == positions
    actual = {(teacher_names[a["teacher_id"]], a["d"], a["p"]): (a["c"], a["l"], a["r"])
              for a in data["assignments"]}
    assert len(actual) == len(data["assignments"]), "Duplicate teacher-period keys"
    assert actual == cells, {"missing": len(cells.keys() - actual.keys()),
                             "extra": len(actual.keys() - cells.keys()),
                             "different": [k for k in cells.keys() & actual.keys() if cells[k] != actual[k]]}
    for assignment in data["assignments"]:
        page, row = teacher_positions[assignment["teacher_id"]]
        column = DAYS.index(assignment["d"]) * 10 + assignment["p"]
        source = assignment["source"]
        assert (source["page"], source["row"], source["column"]) == (page, row, column)
        assert assignment["id"] == f"P{page}-R{row:02}-C{column:02}"
        expected_bbox = [69.63 + 18 * (column - 1), 117.53 if row == 1 else 117.83 + 30 * (row - 1),
                         970.38 if column == 50 else 69.63 + 18 * column, 117.83 + 30 * row]
        assert len(source["bbox"]) == 4
        assert all(abs(a - b) < .01 for a, b in zip(source["bbox"], expected_bbox))
    # Explicitly verify blank periods too, including the entirely empty teacher row.
    blank_checks = 0
    for name in positions.values():
        for day in DAYS:
            for period in range(1, 11):
                key = (name, day, period)
                assert cells.get(key) == actual.get(key)
                blank_checks += key not in cells
    assignments_by_id = {a["id"]: a for a in data["assignments"]}
    represented = []
    for lesson in data["lessons"]:
        assert len(lesson["teacher_ids"]) == len(lesson["assignment_ids"])
        assert len(set(lesson["teacher_ids"])) == len(lesson["teacher_ids"])
        for teacher_id, assignment_id in zip(lesson["teacher_ids"], lesson["assignment_ids"]):
            assignment = assignments_by_id[assignment_id]
            assert assignment["teacher_id"] == teacher_id
            assert all(lesson[k] == assignment[k] for k in ("d", "p", "c", "l", "r"))
            represented.append(assignment_id)
    assert Counter(represented) == Counter(assignments_by_id.keys())
    assert sorted({a["c"] for a in data["assignments"]}) == data["classes"]
    assert sorted({a["l"] for a in data["assignments"]}) == data["course_catalog"]
    for t in data["teachers"]:
        assert t["total_hours"] == sum(a["teacher_id"] == t["id"] for a in data["assignments"])
    result = {"passed": True, "independent_pdf_engine": "pypdf raw content + font CMaps",
              "source_sha256": data["source"]["sha256"], "teachers_checked": len(positions),
              "nonempty_cells_checked": len(cells), "empty_cells_checked": blank_checks,
              "printed_cell_fields_checked": raw_runs,
              "lessons_checked": len(data["lessons"]), "bell_time_values_checked": 400,
              "missing": 0, "extra": 0, "different": 0}
    # Tests use the independently decoded reference, not a copy of app JSON.
    reference = {"source_sha256": data["source"]["sha256"], "times": times,
                 "teacher_names": list(positions.values()),
                 "cells": [{"teacher": key[0], "day": key[1], "period": key[2],
                            "className": value[0], "course": value[1], "room": value[2]}
                           for key, value in cells.items()]}
    (ROOT / "tests/pdf-reference.json").write_text(json.dumps(reference, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--data", type=Path, default=ROOT / "okul_verisi.json")
    parser.add_argument("--report", type=Path, default=ROOT / "tests/pdf-verification.json")
    args = parser.parse_args()
    result = verify(args.pdf, args.data)
    args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
