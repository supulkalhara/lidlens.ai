from fpdf import FPDF
import pikepdf
import os
from pathlib import Path

# Config
PASSWORD = "150519901234" # DDMMYYYY + Last4
OUT_FILE = "/Users/supul/Dev/finance-handler/data/card_statements_locked/test_protected_statement.pdf"
UNLOCKED_DIR = "/Users/supul/Dev/finance-handler/data/card_statements_unlocked"

os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)

# 1. Create PDF
pdf = FPDF()
pdf.add_page()
pdf.set_font("Helvetica", size=12)
pdf.cell(200, 10, txt="LidLens Automated Test Statement", ln=1, align='C')
pdf.cell(200, 10, txt="Card: **** **** **** 1234", ln=1)
pdf.cell(200, 10, txt="Date: 2024-03-15", ln=1)
pdf.cell(200, 10, txt="Transaction: Keells Supermarket - LKR 5000", ln=1)
pdf.cell(200, 10, txt="Transaction: Uber Ride - LKR 1500", ln=1)

temp_pdf = "temp_test.pdf"
pdf.output(temp_pdf)

# 2. Encrypt with Password
with pikepdf.open(temp_pdf) as p:
    p.save(OUT_FILE, encryption=pikepdf.Encryption(owner=PASSWORD, user=PASSWORD))

os.remove(temp_pdf)
print(f"✅ Generated protected PDF at {OUT_FILE} with password {PASSWORD}")
