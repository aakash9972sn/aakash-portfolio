# Original-ink digitization (no Antigravity required)

Install Python 3 and run `python -m pip install pymupdf`. In a clone of this repository, create a JSON file such as:

```json
[{"id":"Q12-figure","page":6,"rect":[116,120,497,363]}]
```

Then run `python scripts/extract-gate-figures.py CS12024.pdf regions.json extracted --dpi 300`.

The script crops the actual PDF, including text, vector drawing and embedded raster ink. It emits lossless PNG files and a manifest with source SHA-256, page, coordinates, image SHA-256 and native text candidates. Crop boxes must be supplied and checked; the script does not automatically locate diagrams, OCR scans, convert equations or generate answers. Use the original complete question when any crop or transcription is uncertain. For scanned PDFs, a higher DPI cannot recover missing source detail.

GATE EC 2025 and 2026 display native question text and lossless WebP crops in the stem and in the corresponding answer controls. The original scan is available under each question. For other papers, a transcription that requires graphics opens the printed question.

To reproduce the 74 published crops, install PyMuPDF and Pillow and run `python scripts/build-gate-ec-ink.py`. The script checks the PDF hashes in `scripts/gate-ec-ink-regions.json`, omits the background seal layer in memory, renders the recorded regions at 216 dpi, and makes pure white transparent. The original paper files retain their full resolution and content. The runner clips trailing page space in the archive preview using each question’s measured `printHeight` in source pixels.

For additional papers, the offline importer prepares text, original-image regions and a review queue. [Batch digitization guide](gate-batch.md)
