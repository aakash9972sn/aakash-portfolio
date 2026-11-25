# Digitize more GATE papers

Run **Prepare GATE papers for review** in the repository’s Actions tab. Enter one or more archive IDs, such as `EC2019 EC2023 EC2024`, or `all`. Download and unzip the **gate-review** artifact, then open a paper’s `review.html` in your browser. Enter a previous run ID to reuse its checkpoints. A run can also process a fixed number of new questions per paper.

The same importer runs locally with Python 3.10+, PyMuPDF, Pillow and Tesseract with English language data. Install Tesseract with your OS package manager and make sure `tesseract --version` works. Publication also uses Node.js to check records against the exam runner.

```sh
python -m pip install "PyMuPDF>=1.25,<2" "Pillow>=10,<13"
python scripts/gate_batch.py prepare EC2019 EC2023 EC2024 --work gate-work
```

The paper IDs come from the EC, EE and CS indexes. The importer works from the archive’s question images or a locally available indexed CS PDF. It reports missing local sources so other papers can finish. Run the same command again after interruption. Each finished question has its own checkpoint. OCR timeouts are recorded per question and the batch continues. Add `--retry-errors` to try them again. Changing a source, question identity, type or importer version invalidates its checkpoint. `--jobs 2` controls concurrent OCR processes. All OCR and comparison run locally.

## What gets published

- A plain question can become native text when the PDF and OCR agree on the question and choices, the printed question number matches, and the ink check finds no unexplained dark strokes.
- For a vertical multiple-choice layout, verified text choices can accompany the original printed stem. All four options must match the PDF. The importer checks the gap before A, option order and remaining ink before splitting. Scanned papers without an independent text layer stay in review.
- The review screen shows the actual archived question beside editable text. Approve a complete transcription or choose **Use selected image regions** and drag the original stem or A–D figures. For image-only choices enter “See printed option A” through “See printed option D”. **Show original question** keeps the full print visible. Crops refer to the existing source pixels. Reviewers can also enter delimited LaTeX.
- Download approvals and publish from a repository checkout. Use the same checkpoint folder, including when you unpack an Actions artifact. Repeat `--decisions` for additional files. Without decision files the command publishes eligible automatic records. The public site continues serving the original for pending questions.

```sh
python scripts/gate_batch.py publish EC2019 EC2023 EC2024 --work gate-work --decisions EC2019-approvals.json
```

Commit the changes under `test-centre/gate-digitized/batch/` to release them. Preparation has no deployment step. Existing native questions and curated banks take precedence. Official keys, marks and question types remain in the archive index. Review state is tied to a source checksum. Use **Download approvals** before moving the review to another browser or device.
