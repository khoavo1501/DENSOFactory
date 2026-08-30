"""JWT helpers (HS256).

Access token: short-lived (default 15 min). Payload: {sub, role, type=access, jti, iat, exp}.
Refresh token: long-lived (default 8 h). Payload: {sub, type=refresh, jti, iat, exp}.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from jose import JWTError, jwt

from app.core.config import get_settings


class JWTError_(Exception):
    pass


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def create_access_token(
    subject: str, role: str, expires_min: Optional[int] = None
) -> tuple[str, str, int]:
    """Returns (token, jti, exp_unix)."""
    settings = get_settings()
    iat = _now()
    exp = iat + timedelta(
        minutes=expires_min or settings.ACCESS_TOKEN_TTL_MIN
    )
    jti = uuid.uuid4().hex
    payload = {
        "sub": subject,
        "role": role,
        "type": "access",
        "jti": jti,
        "iat": int(iat.timestamp()),
        "exp": int(exp.timestamp()),
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
    return token, jti, int(exp.timestamp())


def create_refresh_token(
    subject: str, expires_hours: Optional[int] = None
) -> tuple[str, str, int]:
    """Returns (token, jti, exp_unix)."""
    settings = get_settings()
    iat = _now()
    exp = iat + timedelta(
        hours=expires_hours or settings.REFRESH_TOKEN_TTL_HOURS
    )
    jti = uuid.uuid4().hex
    payload = {
        "sub": subject,
        "type": "refresh",
        "jti": jti,
        "iat": int(iat.timestamp()),
        "exp": int(exp.timestamp()),
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
    return token, jti, int(exp.timestamp())


def decode_token(
    token: str, expected_type: Literal["access", "refresh"]
) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=["HS256"]
        )
    except JWTError as e:
        raise JWTError_(f"invalid token: {e}") from e

    if payload.get("type") != expected_type:
        raise JWTError_(
            f"expected type={expected_type}, got {payload.get('type')}"
        )
    return payload
