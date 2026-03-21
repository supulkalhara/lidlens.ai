"""
Validation script — checks extraction quality of structured JSON output.
"""

import json
import os
from datetime import datetime
from config_loader import get_config


def validate_transaction(row: dict, index: int) -> list[str]:
    """Validate a single transaction and return list of issues."""
    issues = []

    # Check date format
    date = row.get("transaction_date", "")
    if not date:
        issues.append(f"Row {index}: Empty date")
    else:
        try:
            datetime.strptime(date, "%d %b %Y")
        except ValueError:
            issues.append(f"Row {index}: Invalid date format '{date}' (expected 'DD Mon YYYY')")

    # Check amount
    amount = row.get("amount")
    if amount is None or amount == "":
        issues.append(f"Row {index}: Empty amount")
    elif isinstance(amount, (int, float)):
        if amount <= 0:
            issues.append(f"Row {index}: Amount should be positive, got {amount}")
    else:
        try:
            float(amount)
        except (ValueError, TypeError):
            issues.append(f"Row {index}: Invalid amount '{amount}'")

    # Check direction
    direction = row.get("direction", "")
    if direction not in ["debit", "credit"]:
        issues.append(f"Row {index}: Invalid direction '{direction}'")

    # Check currency
    currency = row.get("currency", "")
    if not currency or currency == "null":
        issues.append(f"Row {index}: Empty currency")
    elif len(currency) > 3:
        issues.append(f"Row {index}: Invalid currency '{currency}'")

    # Check description
    description = row.get("description", "")
    if not description or description.strip() == "":
        issues.append(f"Row {index}: Empty description")
    elif description.replace(",", "").replace(".", "").strip().isdigit():
        issues.append(f"Row {index}: Description is just a number '{description}'")

    # Check installment fields consistency
    is_installment = row.get("is_installment", False)
    paid = row.get("installment_paid")
    total = row.get("installment_total")
    if is_installment and paid is None and total is None:
        issues.append(f"Row {index}: is_installment=True but paid/total are null")
    elif is_installment and paid and total and paid > total:
        issues.append(f"Row {index}: installment_paid ({paid}) > installment_total ({total})")

    # Check for suspicious patterns (non-transaction rows)
    desc_upper = description.upper()
    for keyword in ["BALANCE", "OPENING", "CLOSING", "STATEMENT", "TOTAL", "MINIMUM", "CREDIT LIMIT"]:
        if keyword in desc_upper:
            issues.append(f"Row {index}: Suspicious keyword '{keyword}' in description")
            break

    return issues


def validate_file(filepath: str) -> dict:
    """Validate a single JSON file. Returns stats dict."""
    filename = os.path.basename(filepath)
    stats = {"file": filename, "total": 0, "issues": 0, "valid": True}

    try:
        with open(filepath, "r") as f:
            data = json.load(f)

        if not isinstance(data, list):
            print(f"  ❌ {filename}: Not a JSON array")
            stats["valid"] = False
            return stats

        stats["total"] = len(data)
        if len(data) == 0:
            print(f"  ⚠️  {filename}: Empty — no transactions")
            return stats

        all_issues = []
        for i, row in enumerate(data, 1):
            all_issues.extend(validate_transaction(row, i))

        stats["issues"] = len(all_issues)
        if all_issues:
            print(f"  ⚠️  {filename}: {len(all_issues)} issues in {len(data)} transactions")
            for issue in all_issues[:10]:
                print(f"      - {issue}")
            if len(all_issues) > 10:
                print(f"      ... and {len(all_issues) - 10} more")
        else:
            print(f"  ✅ {filename}: {len(data)} transactions — all valid")

        # Summary stats
        debits = sum(1 for r in data if r.get("direction") == "debit")
        credits = sum(1 for r in data if r.get("direction") == "credit")
        other_cat = sum(1 for r in data if r.get("category") == "other")
        print(f"      📊 {debits} debits, {credits} credits, {other_cat} 'other' category")

    except json.JSONDecodeError as e:
        print(f"  ❌ {filename}: Invalid JSON — {e}")
        stats["valid"] = False
    except Exception as e:
        print(f"  ❌ {filename}: Error — {e}")
        stats["valid"] = False

    return stats


def run() -> list[dict]:
    """Validate all structured JSON files. Returns list of stats dicts."""
    config = get_config()
    input_dir = config["pipeline"]["structured_dir"]

    if not os.path.exists(input_dir):
        print(f"⚠️  Directory not found: {input_dir}")
        return []

    json_files = sorted(f for f in os.listdir(input_dir) if f.endswith(".json"))
    if not json_files:
        print(f"⚠️  No JSON files found in {input_dir}")
        return []

    print(f"📋 Validating {len(json_files)} file(s)...")
    results = []
    for filename in json_files:
        filepath = os.path.join(input_dir, filename)
        results.append(validate_file(filepath))

    total_tx = sum(r["total"] for r in results)
    total_issues = sum(r["issues"] for r in results)
    print(f"\n📊 Total: {total_tx} transactions, {total_issues} issues")
    return results


if __name__ == "__main__":
    run()
