"""Extract this school's four-page teacher grid, preserving raw printed values.

Usage: python3 scripts/extract_pdf.py /path/to/source.pdf
Requires pdfminer.six and pdfplumber. Unknown layouts fail instead of guessing.
"""
import argparse
from collections import defaultdict, Counter
import hashlib
import json
from pathlib import Path

import pdfplumber
from pdfminer.converter import PDFPageAggregator
from pdfminer.pdfinterp import PDFPageInterpreter, PDFResourceManager
from pdfminer.pdfpage import PDFPage

DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"]
ROOT = Path(__file__).resolve().parents[1]


class Capture(PDFPageAggregator):
    def render_string(self, state, sequence, color, graphics):
        codes = [cid for part in sequence if isinstance(part, bytes)
                 for cid in state.font.decode(part)]
        self.runs.append({
            "text": "".join(state.font.to_unichr(cid) for cid in codes),
            "x": float(state.matrix[4]), "y": float(state.matrix[5]),
            "size": float(state.fontsize),
            "width": sum(state.font.char_width(cid) * state.fontsize * state.scaling / 100
                         for cid in codes),
        })
        return super().render_string(state, sequence, color, graphics)


def extract(path):
    manager = PDFResourceManager()
    device = Capture(manager)
    interpreter = PDFPageInterpreter(manager, device)
    runs_by_page = []
    with path.open("rb") as stream:
        for page in PDFPage.get_pages(stream):
            device.runs = []
            interpreter.process_page(page)
            runs_by_page.append(device.runs)
    teachers, assignments, times = [], [], {}
    with pdfplumber.open(path) as document:
        assert len(document.pages) == 4, "Expected four source pages"
        for page_number, (page, runs) in enumerate(zip(document.pages, runs_by_page), 1):
            assert (page.width, page.height) == (1008, 792), "Unexpected page dimensions"
            horizontal = sorted(set(round(edge["top"], 2) for edge in page.edges
                                    if edge["orientation"] == "h" and edge["top"] > 110))
            x_counts = Counter(round(edge["x0"], 2) for edge in page.edges
                               if edge["orientation"] == "v" and edge["x0"] > 68)
            # Day separators also have a thicker stroke 0.25 pt to the left.
            # Keep the repeated period-grid strokes, not their border outlines.
            vertical = sorted(x for x, count in x_counts.items() if count >= 10)
            assert len(vertical) == 51, "Expected 50 period columns"
            assert all(abs(vertical[i + 1] - vertical[i] - 18) < .05 for i in range(49))
            assert abs(vertical[50] - vertical[49] - 18) < 1
            assert len(horizontal) - 1 == (9 if page_number == 4 else 21)
            rows, name_parts = defaultdict(lambda: defaultdict(dict)), defaultdict(list)
            headers = defaultdict(dict)
            consumed, field_count = 0, 0
            for run in runs:
                x, top = run["x"], page.height - run["y"]
                center = x + run["width"] / 2
                if run["size"] == 7 and ":" in run["text"]:
                    col = int((center - vertical[0]) // 18)
                    if 0 <= col < 50 and 95 < top < 118:
                        key = "start" if top < 110 else "end"
                        assert key not in headers[col]
                        headers[col][key] = run["text"]
                if not horizontal[0] < top < horizontal[-1]:
                    continue
                row = next((i for i in range(len(horizontal) - 1)
                            if horizontal[i] < top < horizontal[i + 1]), None)
                assert row is not None
                if run["size"] == 6.5 and x < 69:
                    name_parts[row].append((top, x, run["text"]))
                elif run["size"] == 5:
                    consumed += 1
                    col = int((center - vertical[0]) // 18)
                    field = round((top - (124.1 + row * 30)) / 10)
                    assert 0 <= col < 50 and 0 <= field <= 2, (page_number, run)
                    assert abs(top - (124.1 + row * 30 + field * 10)) < .1
                    assert field not in rows[row][col], "Duplicate cell field"
                    rows[row][col][field] = run["text"]
            assert len(headers) == 50 and all(set(x) == {"start", "end"} for x in headers.values())
            page_times = {day: [{"period": period + 1, **headers[d * 10 + period]}
                                for period in range(10)] for d, day in enumerate(DAYS)}
            if times:
                assert times == page_times, "Source pages disagree about bell times"
            times = page_times
            assert len(name_parts) == len(horizontal) - 1
            for row in sorted(name_parts):
                name = " ".join(part[2] for part in sorted(name_parts[row]))
                teacher_id = f"T{len(teachers) + 1:03}"
                teachers.append({"id": teacher_id, "name": name,
                                 "source_page": page_number, "source_row": row + 1,
                                 "total_hours": len(rows[row])})
                for col in sorted(rows[row]):
                    fields = rows[row][col]
                    assert 0 in fields and 1 in fields, "Lesson or class missing"
                    field_count += len(fields)
                    assignments.append({
                        "id": f"P{page_number}-R{row + 1:02}-C{col + 1:02}",
                        "teacher_id": teacher_id, "d": DAYS[col // 10], "p": col % 10 + 1,
                        "c": fields[1], "l": fields[0], "r": fields.get(2, ""),
                        "source": {"page": page_number, "row": row + 1, "column": col + 1,
                                   "bbox": [vertical[col], horizontal[row],
                                            vertical[col + 1], horizontal[row + 1]]},
                    })
            assert consumed == field_count, "Unconsumed source text"
    assert len(teachers) == len(set(t["name"] for t in teachers)) == 72
    keys = [(a["teacher_id"], a["d"], a["p"]) for a in assignments]
    assert len(keys) == len(set(keys)), "Teacher has multiple assignments in one period"
    grouped = defaultdict(list)
    for assignment in assignments:
        grouped[tuple(assignment[k] for k in ("d", "p", "c", "l", "r"))].append(assignment)
    lessons = []
    for key in sorted(grouped, key=lambda k: (DAYS.index(k[0]), k[1], k[2], k[3], k[4])):
        members = grouped[key]
        lessons.append({"id": f"L{len(lessons) + 1:04}",
                        **dict(zip(("d", "p", "c", "l", "r"), key)),
                        "teacher_ids": [a["teacher_id"] for a in members],
                        "assignment_ids": [a["id"] for a in members]})
    return {
        "schema_version": 2,
        "school_info": {"title": "T.C. KARAMAN VALİLİĞİ",
                        "school_name": "Karaman Mesleki ve Teknik Anadolu Lisesi",
                        "document_date": None, "academic_year": None},
        "source": {"filename": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                   "pages": 4, "method": "PDF text positions + drawn grid; raw codes preserved"},
        "days": DAYS, "period_times": times, "teachers": teachers,
        "classes": sorted(set(a["c"] for a in assignments)),
        "course_catalog": sorted(set(a["l"] for a in assignments)),
        "assignments": assignments, "lessons": lessons,
        "statistics": {"teachers": len(teachers), "assignments": len(assignments),
                       "lessons": len(lessons), "shared_lessons": sum(len(x["teacher_ids"]) > 1 for x in lessons),
                       "mesem_assignments": sum("MSM" in a["c"] for a in assignments),
                       "unspecified_rooms": sum(not a["r"] for a in assignments),
                       "assignments_per_page": {str(page): count for page, count in
                                                Counter(a["source"]["page"] for a in assignments).items()}},
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "okul_verisi.json")
    args = parser.parse_args()
    result = extract(args.pdf)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["statistics"], ensure_ascii=False))
