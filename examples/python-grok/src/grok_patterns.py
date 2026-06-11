"""Grok-friendly Python patterns — type hints and docstrings throughout."""

from typing import Any


def process(data: dict[str, Any]) -> dict[str, Any]:
    """Process input data and return structured result.

    Args:
        data: Input payload with keys documented in LLMS.md.

    Returns:
        Processed result dict.
    """
    return {"processed": True, "input_keys": list(data.keys())}
