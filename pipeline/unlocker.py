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
import sqlite3
from pathlib import Path
from datetime import datetime
from config_loader import get_config, get_project_root

MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


def load_cards():
    """Load card metadata from data/cards.json AND the SQLite database."""
    cards = []
    
    # 1. From cards.json (legacy/manual)
    cards_path = get_project_root() / "data" / "cards.json"
    if cards_path.exists():
        try:
            with open(cards_path, "r") as f:
                cards.extend(json.load(f))
        except Exception as e:
            print(f"⚠️  Error loading cards.json: {e}")

    # 2. From SQLite preferences.db
    db_path = get_project_root() / "data" / "preferences.db"
    if db_path.exists():
        try:
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            
            # Get Birthday from user_profile
            cursor.execute("SELECT birthday FROM user_profile LIMIT 1")
            profile_row = cursor.fetchone()
            birthday = profile_row[0] if profile_row else None
            
            # Get Cards from user_assets
            cursor.execute("SELECT name, details FROM user_assets WHERE asset_type = 'card'")
            for row in cursor.fetchall():
                name, details_json = row
                details = json.loads(details_json)
                cards.append({
                    "cardName": name,
                    "cardNumber": details.get("digits", ""), # Support 8 digits
                    "passwordComponents": details.get("passwordComponents", []),
                    "dob": birthday, # Inject birthday from profile
                    "source": "db"
                })
            conn.close()
        except Exception as e:
            print(f"⚠️  Error loading cards from DB: {e}")

    return cards


def generate_password(card: dict) -> list[str]:
    """Generate possible passwords for a card based on its password components and birthday."""
    dob_str = card.get("dob", "")
    cn = card.get("cardNumber", "")
    digits = "".join(c for c in cn if c.isdigit())
    components = card.get("passwordComponents", [])
    
    passwords = []

    # Handle explicit password if provided in legacy cards.json
    if card.get("password"):
        passwords.append(card["password"])

    # 1. New Component-wise logic (Primary)
    if components:
        try:
            combo = []
            dob = datetime.strptime(dob_str, "%Y-%m-%d") if dob_str and dob_str != "YYYY-MM-DD" else None
            
            for comp in components:
                if comp == 'day_dd' and dob:
                    combo.append(f"{dob.day:02d}")
                elif comp == 'month_mm' and dob:
                    combo.append(f"{dob.month:02d}")
                elif comp == 'year_yyyy' and dob:
                    combo.append(str(dob.year))
                elif comp == 'year_yy' and dob:
                    combo.append(str(dob.year)[-2:])
                elif comp == 'card_last_4' and digits:
                    combo.append(digits[-4:])
                elif comp == 'card_last_6' and digits:
                    combo.append(digits[-6:])
                elif comp == 'card_last_8' and digits:
                    combo.append(digits[-8:])
                else:
                    # If any required component is missing (e.g. no birthday but day_dd requested),
                    # we can't build this specific password.
                    pass
            
            if combo:
                passwords.append("".join(combo))
        except Exception as e:
            print(f"⚠️  Error building custom password: {e}")

    # 2. Fallbacks / Legacy patterns (Secondary)
    if dob_str and dob_str != "YYYY-MM-DD":
        try:
            dob = datetime.strptime(dob_str, "%Y-%m-%d")
            dd = f"{dob.day:02d}"
            mm = f"{dob.month:02d}"
            yyyy = str(dob.year)
            
            # Always try pure birthday patterns as a safety net
            passwords.append(f"{dd}{mm}{yyyy}")
            passwords.append(f"{dd}{mm}")

        except ValueError:
            pass

    # 3. Card-number only fallbacks
    if digits:
        passwords.append(digits[-4:])
        if len(digits) >= 6: passwords.append(digits[-6:])
        if len(digits) >= 8: passwords.append(digits[-8:])

    return list(dict.fromkeys(passwords)) # Deduplicate


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
