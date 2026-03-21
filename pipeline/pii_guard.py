"""
PII Guard — wraps LLM prompts/responses using LLM Guard sanitization.

Corrected imports for llm-guard v0.3.x.
Falls back gracefully if llm-guard is not installed or fails to import
(the pipeline still runs, just without PII scanning).
"""

import logging
from config_loader import get_config

log = logging.getLogger(__name__)

_guard_available = False
Anonymize = None
Deanonymize = None
Vault = None

try:
    # llm-guard >= 0.3.x import paths
    from llm_guard.input_scanners import Anonymize
    from llm_guard.output_scanners import Deanonymize
    from llm_guard.vault import Vault
    _guard_available = True
    log.info("LLM Guard loaded successfully")
except ImportError as e:
    log.warning(f"LLM Guard not available — PII scanning disabled. ({e})")


class PIIGuard:
    """
    Wraps LLM Guard's Anonymize/Deanonymize scanners.

    Gracefully degrades: if llm-guard is not installed or pii_guard.enabled
    is False in config.yaml, all methods become no-ops.

    Usage:
        guard = PIIGuard()
        clean_prompt = guard.sanitize_input(raw_prompt)
        # ... send clean_prompt to LLM ...
        original_response = guard.sanitize_output(llm_response)
    """

    def __init__(self):
        config = get_config()
        pii_config = config.get("pii_guard", {})
        self.enabled = pii_config.get("enabled", True) and _guard_available

        if not self.enabled:
            if pii_config.get("enabled", True) and not _guard_available:
                log.warning("pii_guard.enabled=true in config but llm-guard is not installed. Skipping PII scanning.")
            return

        self.entities = pii_config.get("entities", [
            "CREDIT_CARD", "PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "IBAN_CODE"
        ])

        # Fresh Vault per instance (maps anonymized tokens ↔ original values)
        self._vault = Vault()
        self._init_scanners()

    def _init_scanners(self):
        """Initialize Anonymize/Deanonymize with current vault."""
        # llm-guard v0.3.x: Anonymize accepts 'preamble' and 'allowed_names' but
        # the recognizer_conf kwarg was removed. Use entity_types directly.
        self._input_scanner = Anonymize(
            vault=self._vault,
            entity_types=self.entities,
            language="en",
        )
        self._output_scanner = Deanonymize(vault=self._vault)

    def sanitize_input(self, text: str) -> str:
        """Anonymize PII in prompt text before sending to LLM."""
        if not self.enabled or not text:
            return text
        try:
            sanitized, is_valid, risk_score = self._input_scanner.scan("", text)
            if not is_valid:
                log.info(f"    🛡️  PII anonymized (risk: {risk_score:.2f})")
            return sanitized
        except Exception as e:
            log.warning(f"    ⚠️  PII input scan error: {e} — passing text through")
            return text

    def sanitize_output(self, text: str) -> str:
        """Deanonymize tokens in LLM output (restores originals in memory only)."""
        if not self.enabled or not text:
            return text
        try:
            sanitized, is_valid, risk_score = self._output_scanner.scan("", text)
            return sanitized
        except Exception as e:
            log.warning(f"    ⚠️  PII output scan error: {e} — returning original")
            return text

    def clear_vault(self):
        """Reset the vault between documents to avoid token collisions."""
        if not self.enabled:
            return
        self._vault = Vault()
        self._init_scanners()
        log.debug("PII vault cleared")
