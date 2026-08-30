"""CSRF token helpers.

Double-submit cookie pattern:
  - On login/refresh, server sets a non-httpOnly cookie `csrf` (readable by JS).
  - Frontend echoes the value in `X-CSRF-Token` header for any POST/PUT/DELETE.
  - Middleware compares header == cookie; mismatch -> 403.
  - Cookie Max-Age matches access-token TTL (15 min default).
"""
from __future__ import annotations

import secrets


def new_csrf_token() -> str:
    """Cryptographically random 32-byte hex token."""
    return secrets.token_hex(32)
