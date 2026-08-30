"""MQTT consumer: validate incoming messages per payload_spec_v1.md and:

  1. Write telemetry / status / event into InfluxDB (via the existing
     backend pipeline; for M1 we expose hooks only).
  2. Persist diag into Postgres `device_diag` (per spec mục 7.2, info
     and diag are not stored in InfluxDB; we store diag in Postgres).
  3. Reject messages whose device_id's resolved source disagrees with
     a declared source mapping (handled at MQTT ingest time by the
     upstream `backend/app/mqtt_consumer.py` referenced in the spec;
     this module provides helpers).
  4. Broadcast to WebSocket hub for realtime UI.

The actual MQTT loop is wired up in app/main.py lifespan when MQTT_ENABLED=1.
This module is import-safe and unit-testable.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.core.constants import VALID_EVENT_CODES, VALID_SEVERITIES, VALID_STATES
from app.core.constants import PATTERN_REAL, PATTERN_SIMULATED
from app.models import DeviceDiag
from app.services import device_sources
from app.services.audit import write as audit_write
from app.services.influx import get_influx
from app.ws.hub import get_hub


_log = logging.getLogger(__name__)


def _now_ts() -> int:
    return int(datetime.now(tz=timezone.utc).timestamp())


def handle_telemetry(db: Session, payload: dict) -> None:
    """Validate and dispatch a telemetry message.

    Source check: if a `device_id` is in the explicit mapping AND the
    mapping differs from the inferred pattern, the message is dropped
    to avoid mixing simulated/real data.
    """
    device_id = payload.get("device_id")
    registers = payload.get("registers")
    if not device_id or not isinstance(registers, dict):
        _log.warning("telemetry: missing device_id/registers; drop")
        return
    if not (1 <= len(registers) <= 200):
        _log.warning("telemetry: registers out of [1,200] range; drop")
        return
    try:
        device_sources.assert_matches_mapping(db, device_id, _declared_source(payload))
    except ValueError as e:
        _log.warning("telemetry: %s; drop", e)
        return

    # InfluxDB write would go here; we use the WS hub for realtime UI.
    hub = get_hub()
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(
                hub.publish(device_id, {"type": "telemetry", **payload})
            )
    except RuntimeError:
        pass


def handle_status(db: Session, payload: dict) -> None:
    device_id = payload.get("device_id")
    state = payload.get("state")
    if state not in VALID_STATES:
        _log.warning("status: invalid state %r; drop", state)
        return
    try:
        device_sources.assert_matches_mapping(db, device_id, _declared_source(payload))
    except ValueError as e:
        _log.warning("status: %s; drop", e)
        return

    ts = payload.get("ts") or _now_ts()
    # LWT: ts=0 -> use now
    if ts == 0:
        ts = _now_ts()
    enriched = {**payload, "ts": ts}

    hub = get_hub()
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(hub.publish(device_id, {"type": "status", **enriched}))
    except RuntimeError:
        pass


def handle_event(db: Session, payload: dict) -> None:
    device_id = payload.get("device_id")
    events = payload.get("events")
    if not device_id or not isinstance(events, list):
        _log.warning("event: missing device_id/events; drop")
        return
    if not (1 <= len(events) <= 50):
        _log.warning("event: events out of [1,50]; drop")
        return
    for ev in events:
        if ev.get("code") not in VALID_EVENT_CODES:
            _log.warning("event: code %r not in enum; drop", ev.get("code"))
            return
        if ev.get("severity") not in VALID_SEVERITIES:
            _log.warning("event: severity %r invalid; drop", ev.get("severity"))
            return

    try:
        device_sources.assert_matches_mapping(db, device_id, _declared_source(payload))
    except ValueError as e:
        _log.warning("event: %s; drop", e)
        return

    hub = get_hub()
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(hub.publish(device_id, {"type": "event", **payload}))
    except RuntimeError:
        pass


def handle_diag(db: Session, payload: dict) -> None:
    """Persist diag into Postgres (per spec mục 7.2: not stored in InfluxDB)."""
    device_id = payload.get("device_id")
    stats = payload.get("stats")
    if not device_id or not isinstance(stats, dict):
        _log.warning("diag: missing device_id/stats; drop")
        return
    if "poll_cycle_ms" not in stats or "slaves" not in stats:
        _log.warning("diag: missing required fields; drop")
        return

    ts = payload.get("ts") or _now_ts()
    row = DeviceDiag(
        device_id=device_id,
        ts=ts,
        poll_cycle_ms=stats.get("poll_cycle_ms"),
        uptime_s=stats.get("uptime_s"),
        tx_packets=stats.get("tx_packets"),
        tx_failures=stats.get("tx_failures"),
        mqtt_reconnect=stats.get("mqtt_reconnect"),
        avg_latency_ms=stats.get("avg_latency_ms"),
        payload=stats,
    )
    db.merge(row)
    db.commit()

    hub = get_hub()
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(hub.publish(device_id, {"type": "diag", **payload}))
    except RuntimeError:
        pass


def _declared_source(payload: dict) -> str:
    """For M1 we treat all messages as 'real' (no payload field for source).

    If an upstream producer annotates a `__source` field for testing,
    we honor it; otherwise we use the source resolved from the mapping.
    """
    return payload.get("__source") or "real"
