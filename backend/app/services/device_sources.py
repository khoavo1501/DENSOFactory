"""device_sources service: resolve source for a device_id.

Priority:
  1. Explicit mapping in `device_sources` table (overrides pattern).
  2. Pattern inference:
        real:      ^[A-Z]+_[A-Z]+_[0-9]+$
        simulated: ^SIM_[A-Za-z0-9_-]{1,58}$
  3. Default: 'real' (with warning logged upstream).

Validation rule:
  If a payload arrives with device_id whose explicit mapping disagrees with
  the inferred pattern, the caller MUST drop + log the payload (handled
  in mqtt_consumer). This service exposes `assert_matches_mapping` for that.
"""
from __future__ import annotations

import logging
import re
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import (
    PATTERN_REAL,
    PATTERN_SIMULATED,
    SOURCE_REAL,
    SOURCE_SIMULATED,
    VALID_SOURCES,
)
from app.models import DeviceSource


_log = logging.getLogger(__name__)


def infer_from_pattern(device_id: str) -> str:
    if PATTERN_SIMULATED.match(device_id):
        return SOURCE_SIMULATED
    if PATTERN_REAL.match(device_id):
        return SOURCE_REAL
    return SOURCE_REAL  # default


def get_explicit(db: Session, device_id: str) -> Optional[str]:
    row = db.get(DeviceSource, device_id)
    return row.source if row else None


def resolve_source(db: Session, device_id: str) -> str:
    """Return source for a device_id, preferring explicit mapping."""
    explicit = get_explicit(db, device_id)
    if explicit is not None:
        return explicit
    inferred = infer_from_pattern(device_id)
    if not PATTERN_REAL.match(device_id) and not PATTERN_SIMULATED.match(device_id):
        _log.warning(
            "device_id %r does not match any known pattern; defaulting to %s",
            device_id,
            inferred,
        )
    return inferred


def assert_matches_mapping(
    db: Session, device_id: str, declared_source: str
) -> None:
    """Raise ValueError if declared_source conflicts with the resolved source.

    Used by MQTT consumer: if a message claims source=X but mapping says Y,
    the message must be rejected to avoid mixing simulated/real data.
    """
    if declared_source not in VALID_SOURCES:
        raise ValueError(f"unknown source {declared_source!r}")
    resolved = resolve_source(db, device_id)
    if resolved != declared_source:
        raise ValueError(
            f"device_id {device_id!r} mapping mismatch: "
            f"declared={declared_source}, resolved={resolved}"
        )


def list_all(db: Session) -> list[DeviceSource]:
    return list(db.execute(select(DeviceSource).order_by(DeviceSource.device_id)).scalars())


def upsert(
    db: Session, device_id: str, source: str, updated_by: Optional[str]
) -> DeviceSource:
    if source not in VALID_SOURCES:
        raise ValueError(f"invalid source {source!r}")
    if not re.match(r"^[A-Za-z0-9_-]{1,64}$", device_id):
        raise ValueError("invalid device_id format")
    row = db.get(DeviceSource, device_id)
    if row is None:
        row = DeviceSource(
            device_id=device_id, source=source, updated_by=updated_by
        )
        db.add(row)
    else:
        row.source = source
        row.updated_by = updated_by
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, device_id: str) -> bool:
    row = db.get(DeviceSource, device_id)
    if row is None:
        return False
    db.delete(row)
    db.commit()
    return True
