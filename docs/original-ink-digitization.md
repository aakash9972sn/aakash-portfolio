# Original-ink digitization (no Antigravity required)

Install Python 3 and run `python -m pip install pymupdf`. In a clone of this repository, create a JSON file such as:

```json
[{"id":"Q12-figure","page":6,"rect":[116,120,497,363]}]
```

Then run `python scripts/extract-gate-figures.py CS12024.pdf regions.json extracted --dpi 300`.

The script crops the actual PDF, including text, vector drawing and embedded raster ink. It emits lossless PNG files and a manifest with source SHA-256, page, coordinates, image SHA-256 and native text candidates. Crop boxes must be supplied and checked; the script does not automatically locate diagrams, OCR scans, convert equations or generate answers. Use the original complete question when any crop or transcription is uncertain. For scanned PDFs, a higher DPI cannot recover missing source detail.

The CBT now treats legacy AI SVGs as a signal to show the original question rather than rendering generated figures. New Gemini requests ask for transcription only. Official scoring metadata is untouched. The original printed question remains authoritative and is expanded for graphical choices. Publishing independent verified figure crops requires linking them to the appropriate question metadata after review.
