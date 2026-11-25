"""Rebuild the EC exam figures with PyMuPDF and Pillow from the checked-in PDFs."""
import hashlib
import json
from pathlib import Path

import pymupdf
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
REGIONS = Path(__file__).with_name("gate-ec-ink-regions.json")
OUTPUT = ROOT / "test-centre" / "gate-digitized" / "ink"


def write_figure(page, bounds, filename):
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(3, 3), clip=bounds, alpha=False)
    image = pixmap.pil_image().convert("RGB")
    difference = ImageChops.difference(image, Image.new("RGB", image.size, "white"))
    red, green, blue = difference.split()
    mask = ImageChops.lighter(red, ImageChops.lighter(green, blue))
    box = mask.getbbox()
    if not box:
        raise ValueError(f"Empty figure: {filename}")
    image.putalpha(mask.point(lambda pixel: 255 if pixel else 0))
    image.crop(box).save(filename, lossless=True, method=5)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for paper, spec in json.loads(REGIONS.read_text()).items():
        pdf = ROOT / "assets" / "gate-ec" / f"{paper}.pdf"
        if hashlib.sha256(pdf.read_bytes()).hexdigest() != spec["sha256"]:
            raise ValueError(f"Review region coordinates for updated {paper} PDF")
        with pymupdf.open(pdf) as document:
            # The bank's background seal is a separate PDF image layer.
            # Remove it in memory before sampling any ink from the figure.
            x, y = spec["backgroundOrigin"]
            for page in document:
                for item in page.get_image_info(xrefs=True):
                    left, top, *_ = item["bbox"]
                    if abs(left - x) < 1 and abs(top - y) < 1:
                        page.delete_image(item["xref"])
            for name, (page_no, *bounds) in spec["regions"].items():
                write_figure(document[page_no - 1], bounds, OUTPUT / f"{name}.webp")


if __name__ == "__main__":
    main()
