"""
JSON to CSV Converter — converts structured transaction JSON files to CSV format.
"""

import os
import json
import csv
from config_loader import get_config

CSV_FIELDS = [
    "transaction_date",
    "description",
    "amount",
    "currency",
    "direction",
    "category",
    "is_installment",
    "installment_paid",
    "installment_total",
]


def convert_file(json_path: str, output_dir: str) -> str | None:
    """Convert a single JSON file to CSV. Returns output path or None."""
    base = os.path.splitext(os.path.basename(json_path))[0]
    csv_path = os.path.join(output_dir, base + ".csv")

    with open(json_path, "r") as f:
        try:
            rows = json.load(f)
        except json.JSONDecodeError:
            print(f"  ❌ Invalid JSON: {json_path}")
            return None

    if not isinstance(rows, list) or not rows:
        print(f"  ⚠️  Empty or invalid data: {json_path}")
        return None

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field) for field in CSV_FIELDS})

    print(f"  ✅ {os.path.basename(json_path)} → {os.path.basename(csv_path)} ({len(rows)} rows)")
    return csv_path


def run() -> list[str]:
    """Convert all structured JSON files to CSV. Returns list of output paths."""
    config = get_config()
    input_dir = config["pipeline"]["structured_dir"]
    output_dir = config["pipeline"]["csv_dir"]
    os.makedirs(output_dir, exist_ok=True)

    if not os.path.isdir(input_dir):
        print(f"⚠️  Structured directory not found: {input_dir}")
        return []

    outputs = []
    for file in sorted(os.listdir(input_dir)):
        if file.lower().endswith(".json") and not file.endswith("_failed.json"):
            result = convert_file(os.path.join(input_dir, file), output_dir)
            if result:
                outputs.append(result)

    print(f"\n📊 Converted {len(outputs)} files to CSV")
    return outputs


if __name__ == "__main__":
    run()
