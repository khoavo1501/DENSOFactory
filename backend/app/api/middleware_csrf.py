"""CSRF double-submit cookie enforcement for state-changing requests.

Safe methods (GET, HEAD, OPTIONS) and a small allowlist of auth bootstrap
endpoints (login, refresh) are exempt because they do not yet have a session.
"""
from __future__ import annotations

from fastapi import HTTPException, Request, status

from app.core.cookies import COOKIE_CSRF


_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
_EXEMPT_PATHS = {
    "/api/auth/login",
    "/api/auth/refresh",
}


async def csrf_protect(request: Request) -> None:
    if request.method in _SAFE_METHODS:
        return
    if request.url.path in _EXEMPT_PATHS:
        return

    cookie_token = request.cookies.get(COOKIE_CSRF)
    header_token = request.headers.get("X-CSRF-Token")

    if not cookie_token or not header_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token missing",
        )
    if not _constant_time_eq(cookie_token, header_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token mismatch",
        )


def _constant_time_eq(a: str, b: str) -> bool:
    if len(a) != len(b):
        return False
    result = 0
    for x, y in zip(a, b):
        result |= ord(x) ^ ord(y)
    return result == 0
