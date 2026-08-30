"""Smoke test: verify all modules import and FastAPI app builds.

Run: cd backend && python -m tests.test_smoke
"""
import os
import sys

os.environ.setdefault("JWT_SECRET", "x" * 40)
os.environ.setdefault("ADMIN_BOOTSTRAP_USER", "admin")
os.environ.setdefault(
    "ADMIN_BOOTSTRAP_PASSWORD_HASH",
    "$2b$12$abcdefghijklmnopqrstuv",
)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_imports():
    from app import main
    from app.api import admin, auth, devices, events, exports
    from app.core import config, constants, cookies, csrf, jwt, security
    from app.db import session
    from app.mqtt import dispatch
    from app.models import orm
    from app.schemas import common
    from app.services import (
        audit,
        bootstrap,
        cleanup,
        device_sources,
        influx,
    )
    from app.ws import hub
    print("all modules import OK")
    print(f"app: {main.app.title} v{main.app.version}")


def test_config():
    from app.core.config import get_settings
    s = get_settings()
    assert s.JWT_SECRET
    assert s.ACCESS_TOKEN_TTL_MIN >= 1
    assert s.REFRESH_TOKEN_TTL_HOURS >= 1
    assert s.DIAG_RETENTION_DAYS >= 1
    assert s.AUDIT_RETENTION_DAYS >= 1
    assert s.access_token_ttl_sec == s.ACCESS_TOKEN_TTL_MIN * 60
    print("config OK")


def test_pattern_inference():
    from app.services.device_sources import infer_from_pattern
    assert infer_from_pattern("GW_LINE_A_01") == "real"
    assert infer_from_pattern("SIM_LINE_A_01") == "simulated"
    assert infer_from_pattern("UNKNOWN_X") == "real"
    print("pattern inference OK")


def test_jwt_roundtrip():
    from app.core.jwt import create_access_token, decode_token, JWTError_
    token, jti, exp = create_access_token("alice", "admin")
    assert token and jti and exp
    payload = decode_token(token, expected_type="access")
    assert payload["sub"] == "alice"
    assert payload["role"] == "admin"
    assert payload["jti"] == jti
    try:
        decode_token(token, expected_type="refresh")
    except JWTError_:
        print("type check OK")


def test_csrf():
    from app.core.csrf import new_csrf_token
    t1 = new_csrf_token()
    t2 = new_csrf_token()
    assert t1 != t2
    assert len(t1) == 64
    print("csrf OK")


def test_enums():
    from app.core.constants import (
        VALID_EVENT_CODES,
        VALID_SOURCES,
        VALID_STATES,
        VALID_SEVERITIES,
    )
    assert "SLAVE_COMM_LOST" in VALID_EVENT_CODES
    assert VALID_SOURCES == {"simulated", "real"}
    assert "online" in VALID_STATES
    assert "critical" in VALID_SEVERITIES
    print("enums OK")


if __name__ == "__main__":
    test_imports()
    test_config()
    test_pattern_inference()
    test_jwt_roundtrip()
    test_csrf()
    test_enums()
    print("\n=== M1 smoke test: ALL OK ===")
