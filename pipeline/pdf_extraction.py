"""
PDF Extraction — extracts transactions from unlocked credit card statement PDFs.

Pipeline:
  Stage 1 (Ollama, local): Extract raw transaction data from each PDF page.
  Stage 2 (Groq, online):  Normalize, categorize, and validate.
  Stage 3 (Python):        Post-process, validate, deduplicate.

PII Guard wraps all LLM calls to sanitize sensitive data before sending.
"""

import os
import sys
import time
import json
import requests
import PyPDF2
from datetime import datetime
from config_loader import get_config

# Lazy imports for optional dependencies
_groq_client = None


def _get_llm_config():
    config = get_config()
    return config.get("llm", {})


def _get_groq_client():
    global _groq_client
    if _groq_client is None:
        try:
            from groq import Groq
            llm_config = _get_llm_config()
            api_key = llm_config.get("groq", {}).get("api_key", "")
            if not api_key or api_key.startswith("${"):
                raise ValueError("GROQ_API_KEY not set — check .env and config.yaml")
            _groq_client = Groq(api_key=api_key)
        except ImportError:
            raise ImportError("Install groq: pip install groq")
    return _groq_client


def _get_pii_guard():
    """Lazy-load PII guard if enabled in config."""
    config = get_config()
    if config.get("pii_guard", {}).get("enabled", False):
        try:
            from pii_guard import PIIGuard
            return PIIGuard()
        except ImportError:
            print("⚠️  PII guard enabled but llm-guard not installed. Proceeding without it.")
    return None


# -------------------- PDF --------------------

def extract_pages(pdf_path: str) -> list[str]:
    """Extract text from each page of a PDF."""
    pages = []
    with open(pdf_path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
    return pages


# -------------------- LLM --------------------

def ask_llm(prompt: str, pii_guard=None) -> str | None:
    """Send prompt to local Ollama model. Returns raw response text."""
    llm_config = _get_llm_config()
    ollama = llm_config.get("ollama", {})

    host = ollama.get("host", "http://localhost:11434")
    model = ollama.get("model", "qwen2:7b")
    temperature = ollama.get("temperature", 0)
    timeout = ollama.get("timeout", 600)
    max_retries = ollama.get("max_retries", 2)
    num_ctx = ollama.get("num_ctx", 8192)

    # PII guard: sanitize input
    sanitized_prompt = prompt
    if pii_guard:
        sanitized_prompt = pii_guard.sanitize_input(prompt)

    body = {
        "model": model,
        "prompt": sanitized_prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "top_p": 0.9,
            "num_ctx": num_ctx,
        }
    }

    for attempt in range(max_retries):
        try:
            resp = requests.post(f"{host}/api/generate", json=body, timeout=timeout)
            if not resp.ok:
                print(f"  LLM request failed: {resp.status_code}")
                return None
            response_text = resp.json().get("response", "").strip()

            # PII guard: sanitize output
            if pii_guard:
                response_text = pii_guard.sanitize_output(response_text)

            return response_text
        except requests.exceptions.ReadTimeout:
            if attempt < max_retries - 1:
                print(" (timeout, retrying...) ", end="", flush=True)
                time.sleep(5)
            else:
                print(" (timeout after retries) ")
                return None
        except requests.exceptions.RequestException as e:
            print(f"  LLM request error: {e}")
            return None


def ask_groq(messages: list, pii_guard=None, temperature: float = None, max_tokens: int = None) -> str | None:
    """Call Groq API for refinement and category assignment."""
    llm_config = _get_llm_config()
    groq_config = llm_config.get("groq", {})

    if temperature is None:
        temperature = groq_config.get("temperature", 0)
    if max_tokens is None:
        max_tokens = groq_config.get("max_tokens", 8192)
    model = groq_config.get("model", "openai/gpt-oss-120b")

    # PII guard: sanitize input messages
    if pii_guard:
        messages = [
            {**m, "content": pii_guard.sanitize_input(m["content"])}
            for m in messages
        ]

    try:
        client = _get_groq_client()
        completion = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=False,
        )
        response_text = (completion.choices[0].message.content or "").strip()

        # PII guard: sanitize output
        if pii_guard:
            response_text = pii_guard.sanitize_output(response_text)

        return response_text
    except Exception as e:
        print(f"  Groq API error: {e}")
        return None


# -------------------- PROMPTS --------------------

def create_structured_prompt(text: str, statement_year: int) -> str:
    return f"""Extract credit card transactions. Return ONLY valid JSON array.

CRITICAL: Each transaction = separate JSON object (do NOT combine)
CRITICAL: Card holder's personal (vulnerable) information should not be in the JSON. Only the transaction information should be in the JSON.
Mandatory fields:
- transaction_date: Output as "DD Mon YYYY" (e.g. "17 Nov 2025"). Remove any amounts or "CR" from the date field. Use year {statement_year} or {statement_year + 1} for Jan/Feb.
- amount: Positive number only. Remove commas and minus signs.
- currency: "LKR" or "USD" (default LKR).
- direction: "debit" for spending, "credit" for payments/refunds.
- description: Clean merchant name only (no URLs, no amounts).
- is_installment: true if description has "EPP", "X of Y", "X/Y", "Instalment".
- installment_paid, installment_total: Extract numbers from "3/48" or "005 of 060".

IGNORE THESE FROM THE BELOW TEXT:
- Balance, Statement, Total, Limit, headers, owner information, card information, account information

Return ONLY IN JSON (Transaction arrays), no markdown or paragraphs.

TEXT:
{text}
"""


def create_groq_refinement_prompt(raw_text: str, statement_year: int) -> str:
    return f"""You are a personal finance assistant. Below is raw output from an LLM that extracted credit card transactions from a PDF. It may be malformed, truncated, or contain markdown.

Extract ALL transactions you can find. Normalize and categorize them. Use statement year {statement_year} (or {statement_year + 1} for Jan/Feb).

RULES:
1. Keep EVERY transaction as a separate row. Do NOT combine or merge.
2. DELETE only: rows where description is only numbers, or contains "Opening Balance", "Closing Balance", "Total Due", "Statement of Account".
3. KEEP: "Payment 084" and similar payment transactions (they are credits).

NORMALIZE:
- transaction_date: Output as "DD Mon YYYY" (e.g. "17 Nov 2025").
- amount: Positive number only. Remove commas and minus signs.
- currency: "LKR" or "USD" (default LKR).
- direction: "debit" for spending, "credit" for payments/refunds.
- description: Clean merchant name only (no URLs, no amounts).
- is_installment: true if description has "EPP", "X of Y", "X/Y", "Instalment".
- installment_paid, installment_total: Extract numbers from "3/48" or "005 of 060".

CATEGORY (one word, for personal finance management):
Assign exactly ONE category per transaction (lowercase, use underscore for multi-word):
- Supermarkets → groceries
- Restaurants, cafes, food delivery → food
- Petrol, fuel stations → fuel
- Taxi, ride-hail → transport
- Streaming, apps → entertainment
- Online subscriptions → subscriptions
- Electricity, internet, phone → utilities
- Retail, installments → shopping
- Bank fees, stamp duty → fees_taxes
- Card payments, transfers → transfer
- Installment plans → loan_installment
- If unsure → predict based on description

If the amount is null, remove the json object.

OUTPUT: Return ONLY a valid JSON array. Same keys: transaction_date, description, amount, currency, direction, category, is_installment, installment_paid, installment_total. No markdown, no explanation.

RAW OUTPUT:
{raw_text}
"""


def detect_statement_year(pages: list[str]) -> int:
    """Detect statement year from page text."""
    for text in pages:
        for y in range(2022, 2035):
            if str(y) in text:
                return y
    return datetime.now().year


# -------------------- PIPELINE --------------------

def run(input_dir: str = None):
    """
    Extract transactions from all unlocked PDFs.
    Returns list of output JSON file paths.
    """
    config = get_config()
    pdf_dir = input_dir or config["pipeline"]["unlocked_dir"]
    output_dir = config["pipeline"]["structured_dir"]
    os.makedirs(output_dir, exist_ok=True)

    pii_guard = _get_pii_guard()
    output_files = []

    if not os.path.isdir(pdf_dir):
        print(f"⚠️  Unlocked PDF directory not found: {pdf_dir}")
        return []

    for file in sorted(os.listdir(pdf_dir)):
        if not file.lower().endswith(".pdf"):
            continue

        path = os.path.join(pdf_dir, file)
        base = os.path.splitext(file)[0]
        out_file = os.path.join(output_dir, base + ".json")

        if os.path.exists(out_file):
            print(f"  ⏭️  Skipped (already processed): {file}")
            output_files.append(out_file)
            continue

        print(f"\n  📄 Processing: {file}")
        print(f"  {'─' * 50}")

        # Extract text from PDF
        pages = extract_pages(path)
        if not pages:
            print(f"  ❌ Failed: No text extracted from {file}")
            continue

        print(f"    Extracted {len(pages)} pages")
        statement_year = detect_statement_year(pages)
        print(f"    Detected year: {statement_year}")

        # Stage 1: Ollama extracts raw output
        print("    🔍 Stage 1: Ollama extracting...")
        raw_chunks = []
        for i, page_text in enumerate(pages, 1):
            print(f"      Page {i}/{len(pages)}...", end=" ", flush=True)
            raw = ask_llm(create_structured_prompt(page_text, statement_year), pii_guard)
            if raw:
                raw_chunks.append(raw)
            print("done", flush=True)
            time.sleep(0.5)

        if not raw_chunks:
            print(f"    ⚠️  No output from Ollama for {file}")
            continue

        raw_combined = "\n\n".join(raw_chunks)

        # Stage 2: Groq refinement → valid JSON
        print("    🌐 Stage 2: Groq refining...")
        messages = [
            {"role": "user", "content": create_groq_refinement_prompt(raw_combined, statement_year)},
        ]
        response = ask_groq(messages, pii_guard, temperature=0.2)

        if not response:
            print(f"    ⚠️  Groq returned no response for {file}")
            continue

        # Parse response
        response = response.strip()
        if response.startswith("```"):
            lines = response.split("\n")
            response = "\n".join(lines[1:-1]) if len(lines) > 2 else response

        try:
            final_rows = json.loads(response)
            if not isinstance(final_rows, list):
                final_rows = []
        except json.JSONDecodeError:
            print(f"    ⚠️  Invalid JSON response for {file}")
            final_rows = []

        print(f"    ✓ {len(final_rows)} transactions")

        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(final_rows, f, indent=2, ensure_ascii=False)
        print(f"  ✅ Saved {base}.json")
        output_files.append(out_file)

    return output_files


if __name__ == "__main__":
    run()
