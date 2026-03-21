"""
PDF Unlocker — decrypts password-protected credit card statement PDFs.

Reads card metadata from data/cards.json to determine passwords.
Uses the same password generation rules as the dashboard's password-generator.ts.

Supported password methods:
  - last_8_digits: Last 8 digits of card number
  - last_6_digits: Last 6 digits of card number
  - last_4_dob:   Last 4 digits of card + DOB (DDMM format)
  - dob_last_6:   DOB (DDMonYYYY format) + last 6 digits of card
"""

import os
import sys
import json
import pikepdf
from pathlib import Path
from datetime import datetime
from config_loader import get_config, get_project_root

MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


def load_cards():
    """Load card metadata from data/cards.json."""
    cards_path = get_project_root() / "data" / "cards.json"
    if not cards_path.exists():
        print("⚠️  No data/cards.json found. Copy data/cards.json.example and fill in your card details.")
        return []
    with open(cards_path, "r") as f:
        return json.load(f)


def generate_password(card: dict) -> list[str]:
    """Generate possible passwords for a card based on its passwordMethod."""
    method = card.get("passwordMethod", "")
    passwords = []

    # Collect all card numbers from history
    card_numbers = []
    for entry in card.get("history", []):
        cn = entry.get("cardNumber", "")
        card_numbers.append("".join(c for c in cn if c.isdigit()))
    # Also the top-level cardNumber
    top_cn = card.get("cardNumber", "")
    top_digits = "".join(c for c in top_cn if c.isdigit())
    if top_digits and top_digits not in card_numbers:
        card_numbers.append(top_digits)

    dob_str = card.get("dob", "")
    dob_formatted = ""
    if dob_str and dob_str != "YYYY-MM-DD":
        try:
            dob = datetime.strptime(dob_str, "%Y-%m-%d")
            day = f"{dob.day:02d}"
            mon = MONTHS[dob.month - 1]
            year = str(dob.year)
            dob_formatted = f"{day}{mon}{year}"
        except ValueError:
            pass

    for digits in card_numbers:
        if not digits:
            continue
        if method == "last_8_digits":
            passwords.append(digits[-8:])
        elif method == "last_6_digits":
            passwords.append(digits[-6:])
        elif method == "last_4_dob" and dob_formatted:
            dd = f"{datetime.strptime(dob_str, '%Y-%m-%d').day:02d}"
            mm = f"{datetime.strptime(dob_str, '%Y-%m-%d').month:02d}"
            passwords.append(f"{digits[-4:]}{dd}{mm}")
        elif method == "dob_last_6" and dob_formatted:
            passwords.append(f"{dob_formatted}{digits[-6:]}")

    return passwords


def unlock_pdf(input_pdf: str, output_dir: str, passwords: list[str]) -> bool:
    """Try to unlock a PDF with the given list of passwords."""
    basename = os.path.splitext(os.path.basename(input_pdf))[0]
    output_pdf = os.path.join(output_dir, f"{basename}_unlocked.pdf")

    if os.path.exists(output_pdf):
        print(f"  ⏭️  Skipped (already unlocked): {os.path.basename(input_pdf)}")
        return True

    for password in passwords:
        try:
            with pikepdf.open(input_pdf, password=password) as pdf:
                pdf.save(output_pdf)
            print(f"  ✅ Unlocked: {os.path.basename(input_pdf)}")
            return True
        except pikepdf.PasswordError:
            continue
        except Exception as e:
            print(f"  ❌ Error unlocking {os.path.basename(input_pdf)}: {e}")
            return False

    print(f"  ❌ No matching password for: {os.path.basename(input_pdf)}")
    return False


def run(input_path: str = None):
    """
    Unlock all PDFs in the input directory (or a single file).
    Returns list of successfully unlocked file paths.
    """
    config = get_config()
    input_dir = input_path or config["pipeline"]["watch_dir"]
    output_dir = config["pipeline"]["unlocked_dir"]
    os.makedirs(output_dir, exist_ok=True)

    # Gather all possible passwords from cards.json
    cards = load_cards()
    all_passwords = []
    for card in cards:
        all_passwords.extend(generate_password(card))
    all_passwords = list(dict.fromkeys(all_passwords))  # Deduplicate, preserve order

    if not all_passwords:
        print("⚠️  No passwords generated. Check data/cards.json.")
        return []

    unlocked = []

    if input_path and os.path.isfile(input_path):
        if unlock_pdf(input_path, output_dir, all_passwords):
            basename = os.path.splitext(os.path.basename(input_path))[0]
            unlocked.append(os.path.join(output_dir, f"{basename}_unlocked.pdf"))
    else:
        pdf_dir = input_path if input_path and os.path.isdir(input_path) else input_dir
        if not os.path.isdir(pdf_dir):
            print(f"⚠️  Input directory not found: {pdf_dir}")
            return []

        for file in sorted(os.listdir(pdf_dir)):
            if file.lower().endswith(".pdf"):
                filepath = os.path.join(pdf_dir, file)
                if unlock_pdf(filepath, output_dir, all_passwords):
                    basename = os.path.splitext(file)[0]
                    unlocked.append(os.path.join(output_dir, f"{basename}_unlocked.pdf"))

    print(f"\n📊 Unlocked {len(unlocked)} PDFs")
    return unlocked


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else None
    run(path)
