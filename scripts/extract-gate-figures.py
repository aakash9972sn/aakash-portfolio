"""Extract original PDF ink, never redraw it. Requires PyMuPDF.
Usage: python scripts/extract-gate-figures.py source.pdf regions.json output-dir
regions.json: [{"id":"Q12-figure","page":6,"rect":[116,120,497,363]}]
Page numbers are 1-based; rectangle coordinates are unrotated PDF points.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
import pymupdf

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("regions", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--dpi", type=int, default=300, choices=(200, 300, 400, 450))
    args = parser.parse_args()
    raw = args.pdf.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    regions = json.loads(args.regions.read_text(encoding="utf-8"))
    if not isinstance(regions, list) or not regions:
        raise ValueError("Expected a nonempty list of regions")
    args.output.mkdir(parents=True, exist_ok=True)
    seen = set()
    records = []
    with pymupdf.open(stream=raw, filetype="pdf") as doc:
        if len(doc) == 0:
            raise ValueError("PDF has no readable pages")
        for region in regions:
            name, page_no, coords = region["id"], region["page"], region["rect"]
            if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", name) or name in seen:
                raise ValueError("Invalid or duplicate region id")
            seen.add(name)
            if type(page_no) is not int or not 1 <= page_no <= len(doc):
                raise ValueError("Invalid page: " + str(page_no))
            page = doc[page_no-1]
            if page.rotation:
                raise ValueError("Normalize rotated page before using unrotated coordinates")
            rect = pymupdf.Rect(coords)
            if rect.is_empty or rect.is_infinite or not page.rect.contains(rect):
                raise ValueError("Region is outside page: " + name)
            image = page.get_pixmap(clip=rect, dpi=args.dpi, alpha=False)
            png = image.tobytes("png")
            file = args.output / (name + ".png")
            file.write_bytes(png)
            text = page.get_text("text", clip=rect, sort=True)
            records.append({"id":name,"source":args.pdf.name,"sourceSHA256":digest,
                "page":page_no,"rect":list(rect),"dpi":args.dpi,"file":file.name,
                "imageSHA256":hashlib.sha256(png).hexdigest(),"width":image.width,
                "height":image.height,"nativeTextCandidate":text,
                "method":"original-pdf-crop","verification":"needs-human-review"})
    (args.output / "manifest.json").write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Extracted {len(records)} original regions; review coordinates before publication.")

if __name__ == "__main__":
    main()
