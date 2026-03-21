"""
Directory Watcher — Observer pattern for auto-triggering pipeline.

Improvements over v1:
  • Processes pre-existing unprocessed PDFs on startup (no missed files after restart)
  • Structured logging
  • Cleaner debounce implementation
  • Prefect availability check with helpful error message
"""

import os
import sys
import time
import logging
import threading
from pathlib import Path
from config_loader import get_config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [watcher] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    _watchdog_available = True
except ImportError:
    _watchdog_available = False


def _get_processed_marker(pdf_path: str, structured_dir: str) -> str:
    """Return the expected JSON output path for a given PDF."""
    stem = Path(pdf_path).stem
    return os.path.join(structured_dir, f"{stem}.json")


def _is_processed(pdf_path: str, structured_dir: str) -> bool:
    return os.path.exists(_get_processed_marker(pdf_path, structured_dir))


class PDFHandler(FileSystemEventHandler):
    """Handles new PDF file events with debounce."""

    def __init__(self, structured_dir: str, debounce_seconds: float = 2.0):
        super().__init__()
        self._structured_dir = structured_dir
        self._debounce = debounce_seconds
        self._timer = None
        self._pending = set()
        self._lock = threading.Lock()

    def on_created(self, event):
        if event.is_directory:
            return
        if event.src_path.lower().endswith(".pdf"):
            with self._lock:
                self._pending.add(event.src_path)
                log.info(f"📥 New PDF detected: {os.path.basename(event.src_path)}")
                self._reset_timer()

    def on_moved(self, event):
        """Handle files moved/renamed into the watch directory."""
        if not event.is_directory and event.dest_path.lower().endswith(".pdf"):
            with self._lock:
                self._pending.add(event.dest_path)
                log.info(f"📥 PDF moved in: {os.path.basename(event.dest_path)}")
                self._reset_timer()

    def _reset_timer(self):
        if self._timer:
            self._timer.cancel()
        self._timer = threading.Timer(self._debounce, self._trigger_pipeline)
        self._timer.start()

    def _trigger_pipeline(self):
        with self._lock:
            files = list(self._pending)
            self._pending.clear()

        unprocessed = [f for f in files if not _is_processed(f, self._structured_dir)]
        if not unprocessed:
            log.info("All detected PDFs already processed — skipping pipeline.")
            return

        log.info(f"🚀 Triggering pipeline for {len(unprocessed)} PDF(s)...")
        _run_pipeline()


def _run_pipeline():
    """Import and run the Prefect flow."""
    try:
        from flows import lidlens_pipeline
        lidlens_pipeline()
    except ImportError:
        log.error("❌ Could not import flows.py — is Prefect installed?  uv run prefect server start")
    except Exception as e:
        log.error(f"❌ Pipeline error: {e}", exc_info=True)


def _process_existing(watch_dir: str, structured_dir: str):
    """
    On startup, process any PDFs already in watch_dir that haven't been
    converted to JSON yet. Prevents missed files after watcher restarts.
    """
    existing = [
        os.path.join(watch_dir, f)
        for f in os.listdir(watch_dir)
        if f.lower().endswith(".pdf")
    ]
    unprocessed = [f for f in existing if not _is_processed(f, structured_dir)]

    if unprocessed:
        log.info(f"⏳ Found {len(unprocessed)} unprocessed PDF(s) from before startup — running pipeline...")
        _run_pipeline()
    else:
        log.info(f"✅ No backlog — all existing PDFs already processed.")


def run():
    """Start watching the configured directory for new PDFs."""
    if not _watchdog_available:
        log.error("watchdog is not installed. Run: uv sync")
        sys.exit(1)

    config = get_config()
    watch_dir = config["pipeline"]["watch_dir"]
    structured_dir = config["pipeline"]["structured_dir"]
    auto_trigger = config["pipeline"].get("auto_trigger", True)

    if not auto_trigger:
        log.warning("auto_trigger is disabled in config.yaml — watcher will not trigger pipeline.")
        return

    os.makedirs(watch_dir, exist_ok=True)
    os.makedirs(structured_dir, exist_ok=True)

    log.info(f"👁️  Watching: {watch_dir}")
    log.info(f"   Drop PDF files here to trigger the pipeline automatically.")
    log.info(f"   Press Ctrl+C to stop.\n")

    # Process any pre-existing unprocessed PDFs before starting the observer
    _process_existing(watch_dir, structured_dir)

    handler = PDFHandler(structured_dir=structured_dir, debounce_seconds=2.0)
    observer = Observer()
    observer.schedule(handler, watch_dir, recursive=False)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("⏹️  Watcher stopped.")
        observer.stop()
    observer.join()


if __name__ == "__main__":
    run()
