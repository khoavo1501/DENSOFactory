"""Integration test using FastAPI TestClient + Postgres.

Requires docker compose up postgres + influxdb. We connect to the same
Postgres the backend uses; we isolate by truncating tables in a fixture
and recreating the admin user.

Env is set in conftest.py BEFORE any import.
"""
import os
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core import config as _cfg  # noqa: E402

_cfg.get_settings.cache_clear()

from app.db import session as _db_session  # noqa: E402
from app.main import app  # noqa: E402
from app.models import orm  # noqa: E402


_engine = create_engine(_db_session.get_settings().DATABASE_URL)
_db_session.engine = _engine
_db_session.SessionLocal = sessionmaker(
    bind=_engine, autoflush=False, autocommit=False, expire_on_commit=False
)


@pytest.fixture(autouse=True)
def _reset_db():
    # Truncate in dependency order
    with _engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE revoked_refresh, audit_log, "
                "device_diag, device_sources, users RESTART IDENTITY CASCADE"
            )
        )
    db = _db_session.SessionLocal()
    try:
        from app.services.bootstrap import ensure_admin
        ensure_admin(db)
    finally:
        db.close()
    yield


@pytest.fixture
def client():
    return TestClient(app)


def test_healthz(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_login_fail_then_success(client):
    r = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "wrong"},
    )
    assert r.status_code == 401

    r = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == "admin"
    assert body["role"] == "admin"
    assert "at" in r.cookies
    assert "rt" in r.cookies
    assert "csrf" in r.cookies


def test_me_requires_auth(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_me_with_cookie(client):
    client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    r = client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["username"] == "admin"


def test_devices_requires_auth(client):
    r = client.get("/api/devices")
    assert r.status_code == 401


def test_admin_sources_csrf_required(client):
    client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    csrf = client.cookies.get("csrf")
    r = client.put(
        "/api/admin/devices-sources/SIM_LINE_A_01",
        json={"source": "simulated"},
    )
    assert r.status_code == 403

    r = client.put(
        "/api/admin/devices-sources/SIM_LINE_A_01",
        json={"source": "simulated"},
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["device_id"] == "SIM_LINE_A_01"
    assert body["source"] == "simulated"


def test_admin_sources_list(client):
    client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    csrf = client.cookies.get("csrf")
    client.put(
        "/api/admin/devices-sources/SIM_LINE_A_01",
        json={"source": "simulated"},
        headers={"X-CSRF-Token": csrf},
    )
    r = client.get("/api/admin/devices-sources")
    assert r.status_code == 200
    assert any(x["device_id"] == "SIM_LINE_A_01" for x in r.json())


def test_logout_invalid_token_audit(client):
    """Finding #3: logout with forged rt must still write audit."""
    client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    csrf = client.cookies.get("csrf")
    client.cookies.set("rt", "forged.invalid.token")
    r = client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf or ""})
    assert r.status_code == 204

    db = _db_session.SessionLocal()
    try:
        from app.models import AuditLog
        rows = (
            db.query(AuditLog)
            .filter(AuditLog.action == "auth.logout.invalid_token")
            .all()
        )
        assert len(rows) >= 1
    finally:
        db.close()


def test_logout_deletes_cookies_with_attrs(client):
    """Finding #1: delete_cookie must mirror attributes (httponly, secure,
    samesite, path). We verify cookies are cleared with same attributes."""
    client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    csrf = client.cookies.get("csrf")
    r = client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf or ""})
    assert r.status_code == 204
    set_cookies = r.headers.get_list("set-cookie")
    names = [c.split("=")[0] for c in set_cookies]
    assert "at" in names
    assert "rt" in names
    assert "csrf" in names
    for c in set_cookies:
        if c.startswith(("at=", "rt=", "csrf=")):
            assert "Max-Age=0" in c or "1970" in c
            # SameSite + Path must match
            assert "Path=/" in c
            assert "SameSite=strict" in c or "samesite=strict" in c.lower()


def test_infer_pattern_real():
    from app.services.device_sources import infer_from_pattern
    assert infer_from_pattern("GW_LINE_A_01") == "real"
    assert infer_from_pattern("SIM_LINE_A_01") == "simulated"


def test_infer_pattern_unknown_defaults_to_real():
    from app.services.device_sources import infer_from_pattern
    assert infer_from_pattern("UNKNOWN_X") == "real"


# ====== M5: User management ======
def test_admin_list_users(client):
    client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    csrf = client.cookies.get("csrf")
    r = client.get("/api/admin/users")
    assert r.status_code == 200
    body = r.json()
    assert any(u["username"] == "admin" and u["role"] == "admin" for u in body)


def test_admin_create_user(client):
    client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    csrf = client.cookies.get("csrf")
    r = client.post(
        "/api/admin/users",
        json={"username": "v1", "password": "viewerpass1", "role": "viewer"},
        headers={"X-CSRF-Token": csrf or ""},
    )
    assert r.status_code == 201
    assert r.json()["username"] == "v1"
    assert r.json()["role"] == "viewer"


def test_admin_create_user_short_password(client):
    client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    csrf = client.cookies.get("csrf")
    r = client.post(
        "/api/admin/users",
        json={"username": "v2", "password": "short", "role": "viewer"},
        headers={"X-CSRF-Token": csrf or ""},
    )
    assert r.status_code == 400


def test_admin_create_user_duplicate(client):
    client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    csrf = client.cookies.get("csrf")
    body = {"username": "v3", "password": "viewerpass1", "role": "viewer"}
    client.post(
        "/api/admin/users", json=body, headers={"X-CSRF-Token": csrf or ""}
    )
    r = client.post(
        "/api/admin/users", json=body, headers={"X-CSRF-Token": csrf or ""}
    )
    assert r.status_code == 409


def test_admin_change_role_and_password_and_delete(client):
    client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})

    def csrf_header():
        return {"X-CSRF-Token": client.cookies.get("csrf") or ""}

    # create
    r = client.post(
        "/api/admin/users",
        json={"username": "v4", "password": "viewerpass1", "role": "viewer"},
        headers=csrf_header(),
    )
    assert r.status_code == 201
    # change role
    r = client.patch(
        "/api/admin/users/v4/role", json={"role": "admin"}, headers=csrf_header()
    )
    assert r.status_code == 200
    assert r.json()["role"] == "admin"
    # change password
    r = client.patch(
        "/api/admin/users/v4/password",
        json={"password": "newpass123"},
        headers=csrf_header(),
    )
    assert r.status_code == 204
    # login as admin again (CSRF cookie is rotated by every login)
    client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    # delete
    r = client.delete("/api/admin/users/v4", headers=csrf_header())
    assert r.status_code == 204
    # login as v4 should now fail
    r = client.post(
        "/api/auth/login", json={"username": "v4", "password": "newpass123"}
    )
    assert r.status_code == 401


def test_admin_cannot_demote_self(client):
    client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    csrf = client.cookies.get("csrf")
    r = client.patch(
        "/api/admin/users/admin/role",
        json={"role": "viewer"},
        headers={"X-CSRF-Token": csrf or ""},
    )
    assert r.status_code == 400


def test_admin_cannot_delete_self(client):
    client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    csrf = client.cookies.get("csrf")
    r = client.delete(
        "/api/admin/users/admin", headers={"X-CSRF-Token": csrf or ""}
    )
    assert r.status_code == 400


def test_export_telemetry_csv(client):
    """M5: export endpoint returns CSV (uses Postgres for diag, Influx for telemetry; empty here OK)."""
    client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    now = 1_700_000_000
    r = client.get(
        f"/api/exports/telemetry"
        f"?device_id=GW_X&register=hr_100&from={now-3600}&to={now}&format=csv"
    )
    assert r.status_code == 200
    # CSV body — first line is header
    assert r.headers["content-type"].startswith("text/csv")
