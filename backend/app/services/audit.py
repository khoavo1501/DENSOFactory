"""Audit log writer."""
from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models import AuditLog


def write(
    db: Session,
    *,
    action: str,
    user_name: Optional[str] = None,
    target: Optional[str] = None,
    detail: Optional[dict[str, Any]] = None,
) -> None:
    """Insert a row into audit_log. Caller is responsible for committing."""
    row = AuditLog(
        user_name=user_name,
        action=action,
        target=target,
        detail=detail,
    )
    db.add(row)
