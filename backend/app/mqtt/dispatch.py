"""Message handlers for each payload category.

Per spec mục 7.1, every message is validated by the consumer (in
`consumer.py`) before reaching these handlers. Here we apply the
device_sources mapping check (D-11/D-12), then write to InfluxDB
(handled by consumer) and broadcast to WebSocket hub.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.core.constants import VALID_EVENT_CODES, VALID_SEVERITIES, VALID_STATES
from app.services import device_sources, gateways
from app.services.influx import get_influx  # noqa: F401  (used in consumer)
from app.ws.hub import get_hub


_log = logging.getLogger(__name__)


def _now() -> int:
    return int(datetime.now(tz=timezone.utc).timestamp())


def _check_source(db: Session, device_id: str) -> None:
    """Raise ValueError if device_id's resolved source is invalid.

    The MQTT consumer has already verified that the device_id is in the
    valid format (spec mục 1.1) and the payload matches the topic. Here
    we just ensure the device_id has a determinable source so callers
    can label the data.
    """
    # We do NOT hard-code the "expected" source; we trust the resolved
    # one (D-12: explicit mapping > pattern > default). This way, a
    # simulator publishing with id "SIM_*" will resolve to "simulated"
    # and not be rejected.
    _ = device_sources.resolve_source(db, device_id)


def handle_telemetry(db: Session, payload: dict) -> None:
    device_id = payload.get("device_id")
    registers = payload.get("registers")
    if not device_id or not isinstance(registers, dict):
        _log.warning("telemetry: missing device_id/registers; drop")
        return
    if not (1 <= len(registers) <= 200):
        _log.warning("telemetry: registers out of [1,200] range; drop")
        return
    try:
        _check_source(db, device_id)
    except Exception as e:
        _log.warning("telemetry: source check failed: %s; drop", e)
        return

    # M10: keep gateway/plc tables fresh (idempotent upsert)
    try:
        gateways.touch_for_message(
            db, device_id, state="online", fw_version=payload.get("fw")
        )
        gateways.record_snapshot(
            db,
            device_id=device_id,
            ts=payload.get("ts") or _now(),
            registers=registers,
            fw_version=payload.get("fw"),
        )
    except Exception as e:
        _log.warning("telemetry: M10 upsert failed: %s", e)

    hub = get_hub()
    try:
        loop = asyncio.get_running_loop()
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
        _check_source(db, device_id)
    except Exception as e:
        _log.warning("status: source check failed: %s; drop", e)
        return

    ts = payload.get("ts") or _now()
    if ts == 0:
        ts = _now()
    enriched = {**payload, "ts": ts}

    # M10: keep gateway/plc tables fresh (idempotent upsert)
    try:
        gateways.touch_for_message(
            db, device_id, state=state, fw_version=payload.get("fw")
        )
    except Exception as e:
        _log.warning("status: gateway upsert failed: %s", e)

    hub = get_hub()
    try:
        loop = asyncio.get_running_loop()
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
        _log.warning("event: events out of [1,50] range; drop")
        return
    for ev in events:
        if ev.get("code") not in VALID_EVENT_CODES:
            _log.warning("event: code %r not in enum; drop", ev.get("code"))
            return
        if ev.get("severity") not in VALID_SEVERITIES:
            _log.warning("event: severity %r invalid; drop", ev.get("severity"))
            return

    try:
        _check_source(db, device_id)
    except Exception as e:
        _log.warning("event: source check failed: %s; drop", e)
        return

    # M10: record warnings for warning/critical events
    try:
        for ev in events:
            if ev.get("severity") in ("warning", "critical"):
                gateways.record_warning(
                    db,
                    target_type="plc",
                    target_id=device_id,
                    severity=ev["severity"],
                    code=ev["code"],
                    message=ev.get("message"),
                    ts=payload.get("ts") or _now(),
                )
    except Exception as e:
        _log.warning("event: warning record failed: %s", e)

    hub = get_hub()
    try:
        loop = asyncio.get_running_loop()
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
    if "poll_cycle_ms" not in stats or "plcs" not in stats:
        _log.warning("diag: missing required fields; drop")
        return

    try:
        _check_source(db, device_id)
    except Exception as e:
        _log.warning("diag: source check failed: %s; drop", e)
        return

    from app.models import DeviceDiag

    ts = payload.get("ts") or _now()
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
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(hub.publish(device_id, {"type": "diag", **payload}))
    except RuntimeError:
        pass
