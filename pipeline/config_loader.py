"""
Config Loader — loads config.yaml with ${VAR} substitution from .env

Usage:
    from config_loader import get_config
    config = get_config()
    host = config['llm']['ollama']['host']
"""

import os
import re
import yaml
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
_project_root = Path(__file__).resolve().parent.parent
load_dotenv(_project_root / ".env")

_config = None


def _substitute_env_vars(obj):
    """Recursively substitute ${VAR} and ${VAR:default} patterns in config values."""
    if isinstance(obj, str):
        def replacer(match):
            var_expr = match.group(1)
            if ":" in var_expr:
                var_name, default = var_expr.split(":", 1)
            else:
                var_name, default = var_expr, match.group(0)
            return os.environ.get(var_name, default)
        return re.sub(r'\$\{([^}]+)\}', replacer, obj)
    elif isinstance(obj, dict):
        return {k: _substitute_env_vars(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_substitute_env_vars(item) for item in obj]
    return obj


def _resolve_paths(config: dict) -> dict:
    """Resolve relative paths in config to absolute paths based on project root."""
    path_keys = {
        ("dashboard", "statements_dir"),
        ("pipeline", "watch_dir"),
        ("pipeline", "unlocked_dir"),
        ("pipeline", "structured_dir"),
        ("pipeline", "csv_dir"),
        ("rag", "db_path"),
    }
    for section, key in path_keys:
        if section in config and key in config[section]:
            p = config[section][key]
            if not os.path.isabs(p):
                config[section][key] = str(_project_root / p)
    return config


def get_config(config_path: str = None) -> dict:
    """
    Load and return the merged configuration.
    Reads config.yaml, substitutes ${VAR} from .env, resolves relative paths.
    Result is cached after first call.
    """
    global _config
    if _config is not None:
        return _config

    if config_path is None:
        config_path = str(_project_root / "config.yaml")

    with open(config_path, "r") as f:
        raw = yaml.safe_load(f)

    config = _substitute_env_vars(raw)
    config = _resolve_paths(config)
    _config = config
    return config


def get_project_root() -> Path:
    """Return the project root directory."""
    return _project_root


if __name__ == "__main__":
    import json
    config = get_config()
    print(json.dumps(config, indent=2, default=str))
