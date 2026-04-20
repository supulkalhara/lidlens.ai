"""
LidLens Pipeline — Prefect Flow Definitions

Orchestrates the full data pipeline:
  1. Unlock password-protected PDFs
  2. Extract transactions via LLM (Ollama → Groq)
  3. Validate extraction quality
  4. Convert to CSV
  5. Index into RAG vector store

Run with: prefect server start (for UI at localhost:4200)
Then:     python flows.py
"""

from prefect import flow, task, get_run_logger
from config_loader import get_config


@task(name="unlock-pdfs", retries=1, retry_delay_seconds=5)
def unlock_pdfs(input_path: str | None = None) -> list[str]:
    """Unlock password-protected PDF statements."""
    logger = get_run_logger()
    logger.info("🔓 Stage 1: Unlocking PDFs...")

    from unlocker import run as unlock_run
    unlocked = unlock_run(input_path)
    logger.info(f"Unlocked {len(unlocked)} PDFs")
    return unlocked


@task(name="extract-transactions", retries=1, retry_delay_seconds=10)
def extract_transactions() -> list[str]:
    """Extract transactions from unlocked PDFs using LLM pipeline."""
    logger = get_run_logger()
    logger.info("📄 Stage 2: Extracting transactions...")

    from pdf_extraction import run as extract_run
    output_files = extract_run()
    logger.info(f"Extracted to {len(output_files)} JSON files")
    return output_files


@task(name="validate-extractions")
def validate_extractions() -> list[dict]:
    """Validate extraction quality."""
    logger = get_run_logger()
    logger.info("✅ Stage 3: Validating extractions...")

    from validate_extractions import run as validate_run
    results = validate_run()
    total_issues = sum(r.get("issues", 0) for r in results)
    logger.info(f"Validation complete: {total_issues} issues found")
    return results


@task(name="convert-to-csv")
def convert_to_csv() -> list[str]:
    """Convert structured JSON to CSV format."""
    logger = get_run_logger()
    logger.info("📊 Stage 4: Converting to CSV...")

    from json_to_csv import run as csv_run
    outputs = csv_run()
    logger.info(f"Converted {len(outputs)} files to CSV")
    return outputs


@task(name="index-to-rag")
def index_to_rag():
    """Index transactions into RAG vector store for pattern learning."""
    logger = get_run_logger()
    config = get_config()

    if not config.get("rag", {}).get("enabled", False):
        logger.info("📚 RAG disabled in config — skipping")
        return

    logger.info("📚 Stage 5: Indexing into RAG...")
    try:
        from rag_engine import run as rag_run
        rag_run()
        logger.info("RAG indexing complete")
    except ImportError:
        logger.warning("chromadb not installed — skipping RAG indexing")


@flow(name="lidlens-pipeline", description="End-to-end financial data extraction pipeline")
def lidlens_pipeline(input_path: str | None = None):
    """
    Full LidLens pipeline:
    PDF Unlock → LLM Extraction → Validation → CSV → RAG Index

    Args:
        input_path: Optional path to a specific PDF or directory.
                    If None, uses the configured watch_dir.
    """
    logger = get_run_logger()
    logger.info("=" * 60)
    logger.info("🚀 LidLens Pipeline Starting")
    logger.info("=" * 60)

    # Step 1: Unlock PDFs
    unlocked = unlock_pdfs(input_path)

    if not unlocked:
        logger.warning("No PDFs were unlocked — pipeline stopping")
        return

    # Step 2: Extract transactions
    json_files = extract_transactions()

    # Step 3: Validate
    validation = validate_extractions()

    # Step 4: Convert to CSV
    csv_files = convert_to_csv()

    # Step 5: Index into RAG
    index_to_rag()

    logger.info("=" * 60)
    logger.info("✅ LidLens Pipeline Complete")
    logger.info(f"   Unlocked: {len(unlocked)} PDFs")
    logger.info(f"   Extracted: {len(json_files)} JSON files")
    logger.info(f"   CSV files: {len(csv_files)}")
    logger.info("=" * 60)


if __name__ == "__main__":
    # Run the pipeline directly (also registers with Prefect server if running)
    lidlens_pipeline()
