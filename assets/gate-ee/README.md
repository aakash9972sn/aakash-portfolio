# GATE EE source library

The 16 supplied PDFs are recorded in test-centre/gate-ee.js with exact byte lengths and SHA-256 digests. Put unchanged files in assets/gate-ee/ to serve them locally. The browser supports local selection with an exact SHA-256 check and separately labeled external reference copies; those references are not claimed to be byte-identical. The EE timer has its own localStorage key.

This follows the existing GATE CS source-PDF workflow. It does not yet implement EC-style per-question image crops, MCQ/MSQ/NAT auto-scoring, verified question-level keys or topic/unit analytics. Keep 2013 booklet variants separate, and do not treat 2025 buffer questions as part of the 65-question timed paper. The 2015 source prints answers beside questions.
