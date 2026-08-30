"""String utilities."""
from __future__ import annotations


def escape_flux_string(s: str) -> str:
    """Escape a string for safe inclusion inside Flux double quotes.

    Flux string literals only need to escape `\\` and `"`. We also strip
    any character that would allow query injection (newlines, semicolons).
    """
    if s is None:
        return ""
    # Strip control characters that could break out of string literal
    cleaned = "".join(c for c in s if c not in "\n\r\t;")
    return cleaned.replace("\\", "\\\\").replace('"', '\\"')
