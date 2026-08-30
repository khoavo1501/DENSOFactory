"""Cleanup job: config-driven retention.

Reads retention days from Settings (env-driven). NO hard-coded numbers
in this module. When retention policy changes (e.g. compliance demands
2-3 years of audit), only the env var changes.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import AuditLog, DeviceDiag, RevokedRefresh


_log = logging.getLogger(__name__)


def purge_diag(db: Session) -> int:
    settings = get_settings()
    cutoff = int(
        (datetime.now(tz=timezone.utc) - timedelta(days=settings.DIAG_RETENTION_DAYS)).timestamp()
    )
    result = db.execute(
        text("DELETE FROM device_diag WHERE ts < :cutoff"),
        {"cutoff": cutoff},
    )
    db.commit()
    deleted = result.rowcount or 0
    _log.info(
        "diag_cleanup: deleted=%d retention_days=%d",
        deleted,
        settings.DIAG_RETENTION_DAYS,
    )
    return deleted


def purge_audit(db: Session) -> int:
    settings = get_settings()
    cutoff = datetime.now(tz=timezone.utc) - timedelta(
        days=settings.AUDIT_RETENTION_DAYS
    )
    result = db.execute(
        delete(AuditLog).where(AuditLog.ts < cutoff)
    )
    db.commit()
    deleted = result.rowcount or 0
    _log.info(
        "audit_cleanup: deleted=%d retention_days=%d",
        deleted,
        settings.AUDIT_RETENTION_DAYS,
    )
    return deleted


def purge_revoked(db: Session) -> int:
    settings = get_settings()
    cutoff = datetime.now(tz=timezone.utc) - timedelta(
        days=settings.REVOKED_TOKEN_RETENTION_DAYS
    )
    result = db.execute(
        delete(RevokedRefresh).where(RevokedRefresh.expires_at < cutoff)
    )
    db.commit()
    deleted = result.rowcount or 0
    _log.info(
        "revoked_cleanup: deleted=%d retention_days=%d",
        deleted,
        settings.REVOKED_TOKEN_RETENTION_DAYS,
    )
    return deleted


def run_all(db: Session) -> dict:
    return {
        "diag": purge_diag(db),
        "audit": purge_audit(db),
        "revoked_refresh": purge_revoked(db),
    }
