"""Centralized cookie name constants and helpers."""
from app.core.config import get_settings

COOKIE_ACCESS = "at"
COOKIE_REFRESH = "rt"
COOKIE_CSRF = "csrf"


def cookie_common_kwargs():
    settings = get_settings()
    return {
        "httponly": True,
        "secure": settings.COOKIE_SECURE,
        "samesite": "strict",
        "path": "/",
    }


def csrf_cookie_kwargs():
    """CSRF cookie must be readable by JS (httponly=False)."""
    settings = get_settings()
    return {
        "httponly": False,
        "secure": settings.COOKIE_SECURE,
        "samesite": "strict",
        "path": "/",
    }


def delete_cookie_kwargs():
    """Mirror attributes of cookie_common_kwargs for delete_cookie.

    Browsers identify a cookie by (name, domain, path) AND require the
    same secure/samesite attributes to remove it. Without these, the
    cookie remains client-side after logout when COOKIE_SECURE=true.
    """
    settings = get_settings()
    return {
        "httponly": True,
        "secure": settings.COOKIE_SECURE,
        "samesite": "strict",
        "path": "/",
    }


def delete_csrf_cookie_kwargs():
    settings = get_settings()
    return {
        "httponly": False,
        "secure": settings.COOKIE_SECURE,
        "samesite": "strict",
        "path": "/",
    }
