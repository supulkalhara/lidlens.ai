#!/usr/bin/env python3
"""
Build a single consolidated master CSV from all per-statement CSVs.

Walks data/card_statements_csv/, parses each row, infers the bank and
statement year/month from the filename (e.g. "ComBank_2026-03_..."),
deduplicates exact matches across files, and writes:

    data/master_transactions.csv

Columns:
    id                        — stable hash of (date|description|amount|direction|bank)
    date_iso                  — YYYY-MM-DD parsed from transaction_date
    transaction_date          — original string from the CSV
    description, amount, currency, direction, category
    is_installment, installment_paid, installment_total
    bank                      — inferred from filename prefix
    source_file               — basename of the CSV
    statement_year, statement_month  — from filename (YYYY-MM)
    year_mismatch_flag        — true if tx year != statement year
    future_date_flag          — true if date is after today
    duplicate_flag            — true if (date|desc|amount|direction|bank) seen elsewhere
    large_amount_flag         — true if abs(amount) > 99th-percentile of debits
    notes                     — human-readable summary of any flags

Run:  python3 scripts/build_master_csv.py
"""

from __future__ import annotations
import csv
import glob
import hashlib
import os
import re
from collections import Counter, defaultdict
from datetime import datetime, date
from pathlib import Path
from statistics import quantiles


REPO = Path(__file__).resolve().parent.parent
CSV_DIR = REPO / "data" / "card_statements_csv"
OUT_FILE = REPO / "data" / "master_transactions.csv"

FILENAME_RE = re.compile(r"^(?P<bank>[A-Za-z]+)_(?P<year>\d{4})-(?P<month>\d{2})_")


def parse_date(s: str) -> date | None:
    s = (s or "").strip()
    for fmt in ("%d %b %Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def stable_id(*parts: str) -> str:
    h = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()
    return h[:12]


def main() -> int:
    if not CSV_DIR.is_dir():
        print(f"CSV directory not found: {CSV_DIR}")
        return 1

    rows: list[dict] = []
    files = sorted(glob.glob(str(CSV_DIR / "*.csv")))
    if not files:
        print(f"No CSVs in {CSV_DIR}")
        return 1

    today = date.today()

    for f in files:
        base = os.path.basename(f)
        m = FILENAME_RE.match(base)
        bank = m.group("bank") if m else ""
        stmt_year = int(m.group("year")) if m else None
        stmt_month = int(m.group("month")) if m else None

        with open(f, newline="") as fh:
            reader = csv.DictReader(fh)
            for r in reader:
                tx_date_str = (r.get("transaction_date") or "").strip()
                d = parse_date(tx_date_str)
                amount_raw = (r.get("amount") or "").strip()
                try:
                    amount = float(amount_raw) if amount_raw else 0.0
                except ValueError:
                    amount = 0.0

                description = (r.get("description") or "").strip()
                direction = (r.get("direction") or "").strip()
                currency = (r.get("currency") or "").strip()
                category = (r.get("category") or "").strip()

                year_mismatch = False
                if d and stmt_year is not None:
                    # Credit card billing periods regularly span two calendar years:
                    # a Q1 statement (Jan–Mar) often contains transactions from
                    # the prior year's Q4 (Oct–Dec).  Tolerate stmt_year - 1 when
                    # the statement falls in the first quarter (months 1–3) AND the
                    # transaction month is in the last quarter (10–12).
                    expected_years = {stmt_year}
                    if stmt_month <= 3 and d.month >= 10:
                        expected_years.add(stmt_year - 1)
                    if d.year not in expected_years:
                        year_mismatch = True

                future_date = bool(d and d > today)

                row = {
                    "date_iso": d.isoformat() if d else "",
                    "transaction_date": tx_date_str,
                    "description": description,
                    "amount": amount,
                    "currency": currency,
                    "direction": direction,
                    "category": category,
                    "is_installment": (r.get("is_installment") or "").strip(),
                    "installment_paid": (r.get("installment_paid") or "").strip(),
                    "installment_total": (r.get("installment_total") or "").strip(),
                    "bank": bank,
                    "source_file": base,
                    "statement_year": stmt_year if stmt_year is not None else "",
                    "statement_month": stmt_month if stmt_month is not None else "",
                    "year_mismatch_flag": year_mismatch,
                    "future_date_flag": future_date,
                }
                row["id"] = stable_id(
                    row["date_iso"], description.lower(), f"{amount:.2f}", direction, bank
                )
                rows.append(row)

    # Duplicate detection: same (date_iso|desc|amount|direction|bank) across files.
    counts = Counter(r["id"] for r in rows)
    # Large-amount flag: amounts above 99th percentile of debits.
    debit_amts = [abs(r["amount"]) for r in rows if r["direction"] == "debit"]
    big_threshold = float("inf")
    if len(debit_amts) >= 50:
        # quantiles(n=100) gives 99 cut points -> last is the 99th pctile
        big_threshold = quantiles(debit_amts, n=100)[-1]
    elif debit_amts:
        big_threshold = max(debit_amts) * 0.9  # fallback for small datasets

    for r in rows:
        is_dupe = counts[r["id"]] > 1
        is_big = r["direction"] == "debit" and abs(r["amount"]) >= big_threshold
        notes = []
        if r["year_mismatch_flag"]:
            notes.append(
                f"date year {r['date_iso'][:4] or '?'} != statement year {r['statement_year']}"
            )
        if r["future_date_flag"]:
            notes.append(f"future date ({r['date_iso']})")
        if is_dupe:
            notes.append(f"duplicate appears in {counts[r['id']]} files")
        if is_big:
            notes.append("large debit (top 1%)")
        r["duplicate_flag"] = is_dupe
        r["large_amount_flag"] = is_big
        r["notes"] = "; ".join(notes)

    # Sort newest first.
    rows.sort(key=lambda r: (r["date_iso"] or "0000-00-00"), reverse=True)

    fieldnames = [
        "id", "date_iso", "transaction_date", "description", "amount",
        "currency", "direction", "category",
        "is_installment", "installment_paid", "installment_total",
        "bank", "source_file", "statement_year", "statement_month",
        "year_mismatch_flag", "future_date_flag",
        "duplicate_flag", "large_amount_flag", "notes",
    ]

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r)

    # Summary to stdout
    by_flag = defaultdict(int)
    for r in rows:
        if r["year_mismatch_flag"]:
            by_flag["year_mismatch"] += 1
        if r["future_date_flag"]:
            by_flag["future_date"] += 1
        if r["duplicate_flag"]:
            by_flag["duplicate"] += 1
        if r["large_amount_flag"]:
            by_flag["large_amount"] += 1

    print(f"Wrote {len(rows)} rows to {OUT_FILE.relative_to(REPO)}")
    print(f"Files merged: {len(files)}")
    for k, v in sorted(by_flag.items()):
        print(f"  flagged {k:14s}: {v}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
