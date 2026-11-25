"""Prepare, review and publish GATE archive transcriptions locally. See docs/gate-batch.md."""
import argparse
import base64
import csv
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from functools import lru_cache
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unicodedata

from PIL import Image, ImageDraw
import pymupdf as pdf

ROOT = Path(__file__).resolve().parents[1]
CENTRE = ROOT / "test-centre"
BANKS = CENTRE / "gate-digitized"
VERSION = "gate-batch-4"
LABEL = re.compile(r"^Q\s*\.?\s*(\d+)\b", re.I)
OPTION = re.compile(r"^\(([A-D])\)\s*")
VISUAL = re.compile(r"\b(figure|fig\.|shown|diagram|graph|table|circuit|waveform|plot|matrix|matrices|below|following statements|match the)\b", re.I)


def read(path, default=None):
    return json.loads(path.read_text()) if path.exists() else default


def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as out:
        temp = Path(out.name)
        try:
            out.write(data)
        except BaseException:
            out.close()
            temp.unlink(missing_ok=True)
            raise
    try:
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def save(path, value):
    atomic(path, (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode())


@contextmanager
def lock(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as file:
        if os.name == "nt":
            import msvcrt
            file.seek(0)
            msvcrt.locking(file.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(file, fcntl.LOCK_EX)
        yield


def digest(data):
    return hashlib.sha256(data).hexdigest()


def catalogue():
    papers = {}
    for name in ("pyp", "ee", "cs"):
        for paper in read(CENTRE / f"gate-{name}-index.json"):
            papers[paper["id"]] = paper
    return papers


def pdf_path(paper):
    source = paper.get("sourcePdf", "")
    if source.startswith("../assets/"):
        return CENTRE / source
    paper_id = paper["id"]
    return ROOT / "assets" / ("gate-" + paper_id[:2].lower()) / (paper_id + ".pdf")


def normalized(s):
    # Retain signs, punctuation, case and digits when comparing independent readings.
    return re.sub(r"\s+", "", unicodedata.normalize("NFC", s).translate(
        str.maketrans({"’": "'", "‘": "'", "“": '"', "”": '"'})))


def partition(text, kind):
    """Split only when all four printed markers occur once and in order."""
    matches = list(re.finditer(r"(?<!\S)\(([A-D])\)(?=\s|$)", text))
    if kind == "NAT":
        return [text.strip()] if not matches else []
    if [m[1] for m in matches] != list("ABCD"):
        return []
    starts = [0] + [m.end() for m in matches]
    ends = [m.start() for m in matches] + [len(text)]
    return [text[a:b].strip() for a, b in zip(starts, ends)]


def pdf_candidates(doc):
    """Identify same-page rows by unique labels in the PDF's question column."""
    if not doc:
        return {}
    candidates = {}
    seen = Counter()
    for page in doc:
        lines = []
        for block in page.get_text("dict", flags=3)["blocks"]:
            for line in block.get("lines", []):
                spans = [s for s in line["spans"] if s["text"].strip()]
                if not spans:
                    continue
                text = "".join(s["text"] for s in line["spans"]).strip()
                x, y, _, _ = line["bbox"]
                lines.append((y, x, text, spans))
        lines.sort(key=lambda line: (round(line[0]), line[1]))
        anchors = []
        for pos, (y, x, text, _) in enumerate(lines):
            marker = LABEL.match(text)
            if marker and x < page.rect.width * .23 and not re.match(
                    r"\s*[-–—]\s*Q|.*\bcarry\b", text[marker.end():], re.I):
                anchors.append((pos, int(marker[1])))
        for i, (pos, number) in enumerate(anchors):
            seen[number] += 1
            end = anchors[i + 1][0] if i + 1 < len(anchors) else len(lines)
            fields, letters, unsafe = [""], [], [False]
            for j, (_, _, text, spans) in enumerate(lines[pos:end]):
                if j == 0:
                    text = LABEL.sub("", text, count=1).strip()
                if not text:
                    continue
                if re.match(r"^(?:Page\s+\d|Organizing Institute|Q\.?\s*\d+\s*[–—-]\s*Q)", text, re.I):
                    break
                opt = OPTION.match(text)
                if opt:
                    fields.append("")
                    letters.append(opt[1])
                    unsafe.append(False)
                    text = text[opt.end():]
                fields[-1] = (fields[-1] + " " + text).strip()
                if any(s["flags"] & 1 or re.search(r"math|symbol", s["font"], re.I) for s in spans):
                    unsafe[-1] = True
            candidates[number] = (fields, letters, unsafe)
    return {n: v for n, v in candidates.items() if seen[n] == 1}


@lru_cache(maxsize=5)
def batch(path):
    return read(path)


def original(paper, index, doc):
    """Prefer the actual archived question so OCR and review cannot cross question boundaries."""
    path = CENTRE / "gate-papers" / f"{paper['id']}-{index // 8}.json"
    if path.exists():
        return base64.b64decode(batch(path)[index % 8], validate=True), "webp"
    q = paper["questions"][index]
    if not doc or not (q.get("range") or q.get("crop")):
        raise ValueError("local source missing")
    parts = []
    bounds = [q["range"]] if q.get("range") else [
        [[q["crop"][0], q["crop"][1]], [q["crop"][0], q["crop"][2]]]]
    if q.get("context"):
        bounds.insert(0, q["context"])
    for (start, top), (end, bottom) in bounds:
        for n in range(start, end + 1):
            page = doc[n - 1]
            clip = pdf.Rect(0, top if n == start else 0, page.rect.width,
                            bottom if n == end else page.rect.height) & page.rect
            if clip.height >= 3:
                parts.append(page.get_pixmap(matrix=pdf.Matrix(2, 2), clip=clip).pil_image())
    if not parts:
        raise ValueError("empty indexed question range")
    image = Image.new("RGB", (max(im.width for im in parts), sum(im.height for im in parts)), "white")
    y = 0
    for part in parts:
        image.paste(part, (0, y))
        y += part.height
    out = io.BytesIO()
    image.save(out, "PNG")
    return out.getvalue(), "png"


def text_layer(image):
    # Strip long outer table rules from an OCR working copy. The review image
    # and all exam figures always use the untouched original bytes.
    gray = Image.open(io.BytesIO(image)).convert("L")
    ink = gray.point(lambda v: 255 if v < 160 else 0)
    width, height = ink.size
    draw = ImageDraw.Draw(gray)
    for x in range(width):
        if ink.crop((x, 0, x+1, height)).histogram()[255] >= height * .85:
            draw.line((x, 0, x, height), fill=255, width=3)
    for y in range(height):
        if ink.crop((0, y, width, y+1)).histogram()[255] >= width * .85:
            draw.line((0, y, width, y), fill=255, width=3)
    return gray


def ocr(image):
    gray = text_layer(image)
    out = io.BytesIO()
    gray.save(out, "PNG")
    run = subprocess.run(["tesseract", "stdin", "stdout", "-l", "eng", "--psm", "6", "tsv"],
                         input=out.getvalue(), capture_output=True, timeout=90, check=True,
                         env={**os.environ, "OMP_THREAD_LIMIT": "1"})
    lines, tokens, labels = [], [], []
    prev = None
    text_sized = True
    mask = gray.point(lambda v: 255 if v < 160 else 0)
    draw = ImageDraw.Draw(mask)
    for row in csv.DictReader(io.StringIO(run.stdout.decode()), delimiter="\t", quoting=csv.QUOTE_NONE):
        if row["level"] != "5" or not row["text"].strip():
            continue
        line = (row["block_num"], row["par_num"], row["line_num"])
        if line != prev and tokens:
            lines.append(" ".join(tokens))
            tokens = []
        prev = line
        tokens.append(row["text"])
        x, y, w, h = (int(row[k]) for k in ("left", "top", "width", "height"))
        if re.fullmatch(r"\([A-D]\)", row["text"]):
            labels.append((row["text"][1], x, y, h))
        if h > gray.width * .07 or w > gray.width * .55:
            text_sized = False
        draw.rectangle((x-2, y-2, x+w+2, y+h+2), fill=0)
    lines.append(" ".join(tokens))
    return "\n".join(lines), text_sized and mask.getbbox() is None, labels, mask


def extract(raw, question, candidate, number):
    match = re.match(r"^\s*Q\s*\.?\s*(\d+)\b\s*", raw, re.I)
    observed = raw[match.end():] if match else raw
    choices = partition(observed, question["type"])
    fields, letters, unsafe = candidate or ([], [], [True])
    expected = 1 if question["type"] == "NAT" else 5
    valid_pdf = len(fields) == expected and all(fields) and letters == list("ABCD" if expected == 5 else "")
    draft = fields if valid_pdf else choices or [observed] + [""] * (expected - 1)
    agree = bool(match and int(match[1]) == number and valid_pdf and
                 [normalized(s) for s in fields] == [normalized(s) for s in choices])
    # A raster schematic can include only a few characters that OCR never notices.
    # Questions with unresolved non-text ink, technical notation or layout require visual review.
    reason = "Compare OCR with the print" if not agree else "Check notation, layout or figure"
    plain = all(re.fullmatch(r"""[A-Za-z0-9\s.,!?'’‘“”:;()/%₹_\-]+""", s) for s in draft)
    ready = agree and not any(unsafe) and plain and not VISUAL.search(" ".join(draft))
    return draft, "ready" if ready else "needs_review", "" if ready else reason


def printed_stem(data, raw, labels, residual, candidate):
    """Keep the original stem when only the four choices can be certified."""
    if not candidate or [label for label, *_ in labels] != list("ABCD"):
        return None
    fields, letters, unsafe = candidate
    if letters != list("ABCD") or any(unsafe[1:]):
        return None
    fields_ocr = partition(raw, "MCQ")
    if len(fields_ocr) != 5 or any(not re.fullmatch(r"[A-Za-z0-9., %'’/()+−–-]+", s)
            or normalized(s) != normalized(t) for s, t in zip(fields[1:], fields_ocr[1:])):
        return None
    width, height = residual.size
    xs = [x for _, x, _, _ in labels]
    ys = [y for _, _, y, _ in labels]
    if max(xs) > width * .2 or max(xs) - min(xs) > width * .035 or any(
            b - a < height * .022 for a, b in zip(ys, ys[1:])):
        return None
    # Require a continuous whitespace band above A; in a row-based paper
    # this keeps diagrams, fractions and preceding text together in the stem.
    gray = Image.open(io.BytesIO(data)).convert("L")
    dark = gray.point(lambda v: 255 if v < 180 else 0)
    gap = 0
    for y in range(ys[0]-1, max(0, ys[0]-75), -1):
        if dark.crop((0, y, width, y+1)).histogram()[255] <= 6:
            gap += 1
        else:
            gap = 0
        if gap >= 6:
            split = y + 3
            if residual.crop((0, split, width, height)).getbbox() is None:
                return {"native":["Question as printed", *fields[1:]],
                        "hasDiagram":True, "usePrintedFigures":True,
                        "figureBox":[0, 0, width, split], "printedStem":True,
                        "verification":"original-stem-verified-options"}
            break
    return None


def prepare_paper(paper, work, jobs, limit, retry_errors=False):
    pid = paper["id"]
    folder = work / pid
    folder.mkdir(parents=True, exist_ok=True)
    existing = read(BANKS / f"{pid}.json", {})
    qlist = paper["questions"]
    path = pdf_path(paper)
    filehash = digest(path.read_bytes()) if path.is_file() else ""
    if filehash and paper.get("sourceSHA256") and filehash != paper["sourceSHA256"]:
        raise ValueError(f"{pid}: source PDF checksum mismatch")
    doc = pdf.open(path) if filehash else None
    with lock(folder / ".lock"):
        try:
            candidates = pdf_candidates(doc)
            items = []
            counts = Counter()
            for i, q in enumerate(qlist):
                if q.get("native") or existing.get(str(i), {}).get("native"):
                    counts["existing"] += 1
                    continue
                if limit is not None and len(items) >= limit:
                    break
                try:
                    data, ext = original(paper, i, doc)
                except ValueError as err:
                    if str(err) != "local source missing":
                        raise
                    counts["source_missing"] += 1
                    continue
                name = f"q{i+1:03}"
                signature = signature_for(pid, i, q, filehash, data)
                file = folder / (name + ".json")
                scan = folder / (name + "." + ext)
                cached = read(file, {})
                if (cached.get("signature") == signature and scan.exists() and
                        not (retry_errors and cached["status"] == "ocr_failed")):
                    counts["cached"] += 1
                    counts[cached["status"]] += 1
                    continue
                atomic(scan, data)
                # An unavailable/changed source must never leave an older approval publishable.
                number = int(re.search(r"\d+$", q["number"])[0])
                candidate = candidates.get(number)
                items.append((file, data, q, candidate, number, {
                    "paper":pid, "index":i, "type":q["type"], "label":q["number"],
                    "signature":signature, "image":scan.name,
                    "hasContext":bool(q.get("context") or q.get("linkedPrevious"))}))
            def process(item):
                file, data, q, candidate, number, record = item
                try:
                    raw, only_text, labels, residual = ocr(data)
                except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
                    fields = 1 if q["type"] == "NAT" else 5
                    record.update(native=[""] * fields, status="ocr_failed",
                                  reason=f"Local OCR failed ({type(error).__name__}). See the original.")
                    save(file, record)
                    return record["status"]
                draft, status, reason = extract(raw, q, candidate, number)
                # Only plain text with independently checked ink is auto-released.
                if status == "ready" and (record["hasContext"] or not only_text):
                    status, reason = "needs_review", "Check the original for graphics or shared context"
                if status != "ready" and record["image"].endswith(".webp") and not record["hasContext"]:
                    hybrid = printed_stem(data, raw, labels, residual, candidate) if q["type"] != "NAT" else None
                    if hybrid:
                        record["partial"] = hybrid
                        status, reason = "partial", "Choices verified. Review the printed stem for native text."
                record.update(native=draft, status=status, reason=reason)
                save(file, record)
                return status
            with ThreadPoolExecutor(max_workers=jobs) as pool:
                for status in pool.map(process, items):
                    counts[status] += 1
        finally:
            if doc:
                doc.close()
    print(pid, dict(counts), flush=True)


def write_review(folder):
    records = [read(path) for path in sorted(folder.glob("q*.json"))]
    published = read(BANKS / "batch" / (folder.name + ".json"), {})
    curated = read(BANKS / (folder.name + ".json"), {})
    records = [r for r in records if not curated.get(str(r["index"]), {}).get("native")]
    for r in records:
        row = published.get(str(r["index"]), {})
        if row.get("inputHash") == r["signature"] and row.get("verification") == "reviewed-original":
            r.update(status="published", native=row["native"], reason="Published after comparison with this original.")
            r["published"] = row
    template = Path(__file__).with_name("gate-review.html").read_text()
    payload = json.dumps(records, ensure_ascii=False).replace("<", r"\u003c")
    atomic(folder / "review.html", re.sub(r'(<script[^>]+id="gate-records"[^>]*>)\s*\[\]\s*(</script>)',
                  lambda m: m[1] + payload + m[2], template).encode())


def validate_decision(edit, record, width, height, allow_boxes):
    native = edit.get("native")
    expected = 1 if record["type"] == "NAT" else 5
    if not isinstance(native, list) or len(native) != expected or not all(
            isinstance(s, str) and s.strip() and len(s) <= 20000 for s in native):
        raise ValueError("Enter the complete stem and all printed choices")
    bank = {"native":native, "hasDiagram":False, "verification":"reviewed-original"}
    mode = edit.get("graphics", "original")
    if mode not in ("none", "original", "crops"):
        raise ValueError("Unknown graphics setting")
    if mode != "none":
        bank.update(hasDiagram=True, usePrintedFigures=True)
    if mode == "crops":
        if not allow_boxes:
            raise ValueError("Use original print for PDF-reader questions")
        def valid(b):
            return isinstance(b, list) and len(b) == 4 and all(type(i) is int for i in b) and (
                0 <= b[0] < b[2] <= width and 0 <= b[1] < b[3] <= height)
        stem, choices = edit.get("figureBox"), edit.get("optionBoxes")
        if stem is not None:
            if not valid(stem):
                raise ValueError("Stem crop outside source image")
            bank["figureBox"] = stem
        if choices is not None:
            if expected == 1 or not isinstance(choices, list) or len(choices) != 4 or not all(map(valid, choices)):
                raise ValueError("All four graphical option crops must fit inside the source")
            bank["optionBoxes"] = choices
        if not (stem or choices):
            raise ValueError("Select a printed crop")
    return bank


def publish(papers, work, decisions):
    edits = {}
    for edit in decisions:
        key = (edit["paper"], edit["index"])
        if key in edits:
            raise ValueError(f"Duplicate decision: {key}")
        edits[key] = edit
    dest = BANKS / "batch"
    # Writers share a repository-local lock even when using different checkpoint folders.
    with lock(dest / ".lock"):
        manifest = read(dest / "manifest.json", {})
        updates = {}
        for paper in papers:
            pid = paper["id"]
            folder = work / pid
            curated = read(BANKS / f"{pid}.json", {})
            old = read(dest / f"{pid}.json", {})
            result = {}
            path = pdf_path(paper)
            filehash = digest(path.read_bytes()) if path.is_file() else ""
            if filehash and paper.get("sourceSHA256") and filehash != paper["sourceSHA256"]:
                raise ValueError(f"{pid}: PDF checksum mismatch")
            doc = pdf.open(path) if filehash else None
            try:
                for i, q in enumerate(paper["questions"]):
                    key = str(i)
                    if q.get("native") or curated.get(key, {}).get("native"):
                        continue
                    rec = read(folder / f"q{i+1:03}.json")
                    previous = old.get(key)
                    if not (rec or previous):
                        continue
                    data, ext = original(paper, i, doc)
                    sig = signature_for(pid, i, q, filehash, data)
                    if previous and previous.get("inputHash") == sig:
                        result[key] = previous
                    edit = edits.pop((pid, i), None)
                    if not rec or rec["signature"] != sig:
                        if edit:
                            raise ValueError(f"{pid} {q['number']}: source changed; prepare again")
                        continue
                    if edit:
                        if edit.get("signature") != sig:
                            raise ValueError(f"{pid} {q['number']}: stale review")
                        with Image.open(io.BytesIO(data)) as im:
                            row = validate_decision(edit, rec, *im.size, ext == "webp")
                    elif rec["status"] == "ready" and key not in result:
                        row = {"native":rec["native"], "hasDiagram":False, "verification":"pdf-ocr-match"}
                    elif rec["status"] == "partial" and key not in result:
                        row = rec["partial"]
                    else:
                        continue
                    result[key] = {**row, "inputHash":sig}
            finally:
                if doc:
                    doc.close()
            if result or old:
                updates[pid] = result
        if edits:
            raise ValueError(f"Review did not match a prepared, unprotected question: {next(iter(edits))}")
        # Validate with the real exam loader before changing any public file.
        if updates:
            subprocess.run(["node", "--input-type=module", "-e", """
import {readFileSync} from 'node:fs';
import {applyDigitizedRecord} from './test-centre/gate-transcription.mjs';
const {updates, types}=JSON.parse(readFileSync(0,'utf8'));
for (const [id,records] of Object.entries(updates)) for (const [i,row] of Object.entries(records)) {
  if (!applyDigitizedRecord({paper:{id},index:Number(i),question:{type:types[id][i]}},row,true))
    throw Error(id+' Q'+(Number(i)+1)+': invalid transcription');
}
"""], cwd=ROOT, input=json.dumps({"updates":updates, "types":{
                p["id"]:[q["type"] for q in p["questions"]] for p in papers}}).encode(), check=True)
        for pid, rows in updates.items():
            data = (json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
            atomic(dest / (pid + ".json"), data)
            if rows:
                manifest[pid] = digest(data)[:16]
            else:
                manifest.pop(pid, None)
            print(f"{pid}: {len(rows)} published questions")
        save(dest / "manifest.json", manifest)


def signature_for(pid, index, question, pdf_hash, image):
    fields = [VERSION.encode(), pid.encode(), str(index).encode(), question["number"].encode(),
              question["type"].encode(), pdf_hash.encode(), image]
    if question.get("context") or question.get("linkedPrevious"):
        fields.append(json.dumps([question.get("context"), question.get("linkedPrevious")]).encode())
    return digest(b"\0".join(fields))


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("command", choices=["prepare", "publish"])
    cli.add_argument("papers", nargs="+", help="Indexed paper IDs, or all")
    cli.add_argument("--work", type=Path, default=ROOT / ".gate-batch")
    cli.add_argument("--jobs", type=int, default=2, choices=range(1, 17), metavar="1..16")
    cli.add_argument("--retry-errors", action="store_true", help="Retry failed OCR checkpoints when preparing")
    cli.add_argument("--limit", type=int, help="Prepare at most this many new questions per paper this run")
    cli.add_argument("--decisions", type=Path, action="append", default=[], help="Reviewed JSON exported from review.html")
    args = cli.parse_args()
    if args.limit is not None and (args.command != "prepare" or args.limit < 1):
        cli.error("--limit requires prepare and a positive integer")
    if args.decisions and args.command != "publish":
        cli.error("--decisions applies to publish")
    index = catalogue()
    ids = list(index) if args.papers == ["all"] else list(dict.fromkeys(args.papers))
    if set(ids) - index.keys():
        cli.error("Unknown paper IDs: " + ", ".join(sorted(set(ids) - index.keys())))
    selected = [index[pid] for pid in ids]
    if args.command == "prepare":
        for paper in selected:
            prepare_paper(paper, args.work, args.jobs, args.limit, args.retry_errors)
            write_review(args.work / paper["id"])
    else:
        decisions = []
        for path in args.decisions:
            decisions.extend(json.loads(path.read_text()))
        publish(selected, args.work, decisions)


if __name__ == "__main__":
    main()
