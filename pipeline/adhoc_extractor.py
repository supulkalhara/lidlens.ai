"""
LidLens.ai — Adhoc Document Extractor (BYOD)

This script processes any financial PDF or Image uploaded at runtime.
It uses:
  - pypdf2/pikepdf for PDF text extraction.
  - Groq (LLM) for structured financial data extraction.
  - Fallback logic for various document types (Receipts, Invoices, Statements).
"""

import os
import sys
import json
import logging
from pathlib import Path
from PyPDF2 import PdfReader
from config_loader import get_config
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [adhoc] %(levelname)s %(message)s")
log = logging.getLogger(__name__)

def extract_text_from_pdf(pdf_path):
    """Simple text extraction from PDF."""
    try:
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        log.error(f"PDF extraction error: {e}")
        return ""

def process_with_groq(text, filename):
    """Use Groq to turn raw text into a structured 'LidLens Dashboard' JSON."""
    config = get_config()
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        log.warning("GROQ_API_KEY not found — returning mock dashboard for testing.")
        return json.dumps({
            "doc_type": "Bank Statement (Mocked)",
            "currency": "LKR",
            "merchant": "HNB Bank (Demo)",
            "date": "2024-03-01",
            "summary": {"total_amount": 14150.00, "tax_amount": 0.00, "subtotal": 13700.00, "due_date": "2024-03-25"},
            "line_items": [
                {"date": "2024-03-01", "description": "Keells Supermarket", "amount": 12500.00, "category": "Groceries"},
                {"date": "2024-02-28", "description": "Uber Ride", "amount": 1200.00, "category": "Transport"},
                {"date": "2024-02-28", "description": "Interest Charges", "amount": 450.00, "category": "Bills"}
            ],
            "insights": ["Overall spending is within limits.", "Subscription detected: Spotify", "High spend at Keells"],
            "dashboard_config": {"primary_widget": "Pie", "accent_color": "#0ea5e9"}
        })

    # Prompt identifies the doc type and extracts key metrics
    prompt = f"""
    ### LidLens.ai - Master Financial Extractor (BYOD)
    
    TASK: Deeply analyze the financial text from file '{filename}' and reconstruct its full logic.
    
    1. INTENT RECOGNITION:
       Is this a:
       - Statement (List of bank/card transactions)?
       - Receipt (Single merchant, single point of sale)?
       - Invoice (B2B bill, payment terms, line items)?
       - Tax Form (Official government document)?
       - Utility/Service Bill (Subscription or one-off)?
       - Other Financial Doc?

    2. ENTITY EXTRACTION GUIDELINES:
       - CURRENCY: Detect from symbols ($, LKR, Rs, USD).
       - TOTALS: Identify the final 'Grand Total' or 'Final Balance'. Ignore intermediate subtotals unless primary.
       - DATES: Identify 'Statement Date' or 'Transaction Date'. If multiple, use the most recent.
       - MERCHANT: Name of the providing entity (Bank, Shop, Vendor).

    3. STRATEGIC ANALYSIS & DASHBOARD CONFIG:
       - Suggest a PRIMARY visualization: 'Pie' (for spending breakdown) or 'Bar' (for itemized comparisons).
       - Suggest an ACCENT color: Use branding colors (e.g. blue for Chase, red for Amex, green for Grab).

    4. INSIGHT GENERATION:
       Provide 2-3 professional financial insights:
       - 'High tax component (X%)'
       - 'Upcoming due date risk'
       - 'Category concentration'
       
    RETURN DATA in the following STRICT JSON format:
    {{
      "doc_type": "The identified document category",
      "currency": "LKR/USD/EUR/etc",
      "merchant": "Merchant or Issuer name",
      "date": "Document main date (YYYY-MM-DD)",
      "summary": {{
        "total_amount": float,
        "tax_amount": float,
        "subtotal": float,
        "due_date": "YYYY-MM-DD or null"
      }},
      "line_items": [
        {{ "date": "YYYY-MM-DD", "description": "text", "amount": float, "category": "Suggest a high-level category" }}
      ],
      "insights": ["Insight 1", "Insight 2"],
      "dashboard_config": {{
        "primary_widget": "Pie" | "Bar",
        "accent_color": "hex_code"
      }}
    }}

    TEXT TO AUDIT:
    ---
    {text[:8000]} 
    ---
    """

    try:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": "You are a professional financial auditor and data architect for LidLens.ai."},
                {"role": "user", "content": prompt}
            ],
            "response_format": { "type": "json_object" },
            "temperature": 0.1
        }
        res = requests.post(url, headers=headers, json=data, timeout=30)
        res.raise_for_status()
        return res.json()["choices"][0]["message"]["content"]
    except Exception as e:
        log.error(f"Groq API error: {e}")
        return json.dumps({"error": str(e)})

def run(file_path):
    """Main execution path."""
    if not os.path.exists(file_path):
        print(json.dumps({"error": "File not found"}))
        return

    filename = os.path.basename(file_path)
    extension = filename.lower().split(".")[-1]

    text = ""
    if extension in ["pdf", "txt"]:
        text = extract_text_from_pdf(file_path)
    else:
        # For images, we'd need OCR. 
        # For now, let's assume we use Tesseract or similar if available, 
        # but as a fallback, we'll tell the user we need OCR.
        print(json.dumps({"error": "OCR for images is pending installation of Tesseract. Please upload searchable PDFs for now."}))
        return

    if not text:
        print(json.dumps({"error": "Empty or non-searchable document. Try a different file."}))
        return

    result_json = process_with_groq(text, filename)
    print(result_json)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python adhoc_extractor.py <file_path>"}))
    else:
        run(sys.argv[1])
