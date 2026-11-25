"""Regression checks for offline GATE publication. Run python -m unittest discover -s tests -p 'test_gate_batch.py'."""
import importlib.util
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("gate_batch", ROOT / "scripts/gate_batch.py")
batch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(batch)


class GateBatchTest(unittest.TestCase):
    def test_option_integrity(self):
        self.assertEqual(batch.partition("Stem (A) a (C) c (B) b (D) d", "MSQ"), [])
        self.assertEqual(batch.partition("Stem (A) a", "NAT"), [])
        self.assertEqual(batch.partition("Stem (A) a (B) b (C) c (D) d", "MCQ"), ["Stem","a","b","c","d"])

    def test_review_boxes_are_in_original_pixel_coordinates(self):
        decision = {"native":["Stem","a","b","c","d"], "graphics":"crops", "figureBox":[0,0,101,2]}
        with self.assertRaises(ValueError):
            batch.validate_decision(decision, {"type":"MCQ"}, 100, 100, True)
        decision["figureBox"] = [1,2,99,100]
        with self.assertRaises(ValueError):
            batch.validate_decision(decision, {"type":"MCQ"}, 100, 100, False)
        self.assertEqual(batch.validate_decision(decision, {"type":"MCQ"}, 100, 100, True)["figureBox"],[1,2,99,100])

    def test_resume_and_stale_review(self):
        q = {"number":"Q1","type":"NAT"}
        paper = {"id":"EE0000","questions":[q,{"number":"Q2","type":"NAT"}]}
        image = io.BytesIO()
        Image.new("RGB",(100,100),"white").save(image,"WEBP")
        def recognition(_):
            return "Q.1 Calculate x", True, [], Image.new("L",(100,100))
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            work = root / "work"
            with patch.object(batch, "BANKS", root/"banks"), patch.object(batch,"original",return_value=(image.getvalue(),"webp")), patch.object(batch,"ocr",side_effect=recognition) as ocr:
                for _ in range(3):
                    batch.prepare_paper(paper,work,1,1)
                self.assertEqual(ocr.call_count,2)
                rec = batch.read(work / "EE0000/q001.json")
                edit = {**rec,"native":["Calculate x."],"graphics":"none"}
                with self.assertRaisesRegex(ValueError,"stale review"):
                    batch.publish([paper],work,[{**edit,"signature":"wrong"}])
                self.assertFalse((batch.BANKS/"batch/manifest.json").exists())
                batch.publish([paper],work,[edit])
                path = batch.BANKS/"batch/EE0000.json"
                first = path.read_bytes()
                batch.publish([paper],work,[])
                self.assertEqual(path.read_bytes(),first)
                self.assertEqual(json.loads(first)["0"]["native"],["Calculate x."])
                self.assertNotIn("1",json.loads(first))
