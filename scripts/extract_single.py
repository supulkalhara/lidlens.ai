#!/usr/bin/env python3
"""
Extract transactions from a single unlocked PDF and produce JSON + CSV.
Usage: python3 scripts/extract_single.py <pdf_filename>
  pdf_filename — just the basename, must exist in data/card_statements_unlocked/
"""
from __future__ import annotations
import sys
import os
import json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "pipeline"))
os.chdir(str(REPO))

from pdf_extraction import extract_pages, detect_statement_year, create_groq_direct_prompt, ask_groq, _get_pii_guard
from json_to_csv import convert_file

PDF_DIR  = REPO / "data" / "card_statements_unlocked"
JSON_DIR = REPO / "data" / "card_statements_structured"
CSV_DIR  = REPO / "data" / "card_statements_csv"

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "Usage: extract_single.py <pdf_filename>"}))
        sys.exit(1)

    pdf_name = Path(sys.argv[1]).name  # strip any directory prefix
    pdf_path = PDF_DIR / pdf_name
    if not pdf_path.exists():
        print(json.dumps({"ok": False, "error": f"Not found: {pdf_name}"}))
        sys.exit(1)

    stem = pdf_path.stem
    out_json = JSON_DIR / (stem + ".json")
    JSON_DIR.mkdir(parents=True, exist_ok=True)
    CSV_DIR.mkdir(parents=True, exist_ok=True)

    pages = extract_pages(str(pdf_path))
    if not pages:
        print(json.dumps({"ok": False, "error": "No text extracted", "rows": 0}))
        sys.exit(0)

    year = detect_statement_year(pages)
    pii = _get_pii_guard()
    final_rows: list = []

    for page_text in pages:
        chunks = [page_text[j:j+4000] for j in range(0, len(page_text), 4000)]
        for chunk in chunks:
            msgs = [{"role": "user", "content": create_groq_direct_prompt(chunk, year)}]
            resp = ask_groq(msgs, pii, temperature=0.1)
            if not resp:
                continue
            resp = resp.strip()
            if resp.startswith("```"):
                lines = resp.split("\n")
                resp = "\n".join(lines[1:-1])
            try:
                rows = json.loads(resp)
                if isinstance(rows, list):
                    final_rows.extend(rows)
            except Exception:
                pass

    with open(out_json, "w") as f:
        json.dump(final_rows, f, indent=2)

    csv_out = convert_file(str(out_json), str(CSV_DIR))
    print(json.dumps({
        "ok": True,
        "rows": len(final_rows),
        "json": str(out_json),
        "csv": csv_out or "",
    }))

if __name__ == "__main__":
    main()
