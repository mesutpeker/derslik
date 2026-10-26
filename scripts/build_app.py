"""Build a single HTML with local CSS, JavaScript and canonical JSON embedded."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def build():
    data = json.loads((ROOT / "okul_verisi.json").read_text(encoding="utf-8"))
    serialized = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    # Keep arbitrary source text inside its inert JSON script element.
    serialized = serialized.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    html = (ROOT / "template.html").read_text(encoding="utf-8")
    for marker, value in {
        "/* STYLES */": (ROOT / "styles.css").read_text(encoding="utf-8"),
        "/* DATA */": serialized,
        "/* CORE */": (ROOT / "app-core.js").read_text(encoding="utf-8"),
        "/* UI */": (ROOT / "app-ui.js").read_text(encoding="utf-8"),
    }.items():
        assert html.count(marker) == 1
        html = html.replace(marker, value)
    assert 'src="http' not in html and 'href="http' not in html
    (ROOT / "index.html").write_text(html, encoding="utf-8")
    print(f"Built offline index.html: {len(html.encode('utf-8')):,} bytes")


if __name__ == "__main__":
    build()
