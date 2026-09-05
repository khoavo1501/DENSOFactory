"""M10: Gateway / PLC / Snapshot / Warning upsert helpers.

Called from the MQTT consumer dispatch. Treats a single MQTT topic
`devices/{device_id}/...` as both the gateway (gateway_id) and the
PLC (plc_id) — one gateway == one PLC for the simulator. Real-world
deployments can override `gateway_id` per device later.

Schema notes:
- `gateways.status` (not `last_state`); default 'offline'.
- `plcs.operating_status` default 'stopped'.
- New telemetry row -> insert into `plc_snapshots` (time-series).
- Warning events with severity warning/critical -> insert into `warnings`.

Vocabulary (per payload spec v1.1):
- gateway = STM32+W5500 (formerly "master")
- plc = Modbus slave (formerly "slave")
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Gateway,
    PLC,
    PLCAssignment,
    PLCSnapshot,
    Warning,
)


_log = logging.getLogger(__name__)


def _now() -> int:
    return int(datetime.now(tz=timezone.utc).timestamp())


def _ensure_gateway(
    db: Session,
    gateway_id: str,
    *,
    name: Optional[str] = None,
    fw_version: Optional[str] = None,
    ip: Optional[str] = None,
) -> Gateway:
    g = db.get(Gateway, gateway_id)
    if g is None:
        g = Gateway(
            gateway_id=gateway_id,
            name=name or gateway_id,
            status="offline",
            fw_version=fw_version,
            ip=ip,
            last_seen_ts=_now(),
        )
        db.add(g)
        db.flush()
    else:
        if name:
            g.name = name
        if fw_version:
            g.fw_version = fw_version
        if ip:
            g.ip = ip
        g.last_seen_ts = _now()
    return g


def _ensure_plc(
    db: Session,
    plc_id: str,
    gateway_id: str,
    *,
    name: Optional[str] = None,
) -> PLC:
    p = db.get(PLC, plc_id)
    if p is None:
        p = PLC(
            plc_id=plc_id,
            gateway_id=gateway_id,
            name=name or plc_id,
            operating_status="stopped",
            status="offline",
            last_seen_ts=_now(),
        )
        db.add(p)
        db.flush()
    else:
        if p.gateway_id != gateway_id:
            p.gateway_id = gateway_id
        if name:
            p.name = name
        p.last_seen_ts = _now()
    return p


def _ensure_assignment(db: Session, plc_id: str, gateway_id: str) -> None:
    existing = db.execute(
        select(PLCAssignment).where(PLCAssignment.plc_id == plc_id)
    ).scalar_one_or_none()
    if existing is None:
        db.add(PLCAssignment(plc_id=plc_id, gateway_id=gateway_id))
    elif existing.gateway_id != gateway_id:
        existing.gateway_id = gateway_id


def touch_for_message(
    db: Session,
    device_id: str,
    *,
    state: Optional[str] = None,
    fw_version: Optional[str] = None,
) -> None:
    """Single-shot helper called from each handler. Treats the device_id
    as both gateway_id and plc_id (simulator model). Idempotent."""
    if state not in (None, "online", "offline", "error", "degraded"):
        state = None
    if state == "degraded":
        state = "online"  # collapse to allowed enum
    g = _ensure_gateway(db, device_id, name=device_id, fw_version=fw_version)
    p = _ensure_plc(db, plc_id=device_id, gateway_id=device_id, name=device_id)
    if state is not None:
        g.status = state
        p.status = state
    _ensure_assignment(db, device_id, device_id)
    db.commit()


def record_snapshot(
    db: Session,
    *,
    device_id: str,
    ts: int,
    registers: dict,
    fw_version: Optional[str] = None,
) -> None:
    """Insert a snapshot row from a telemetry payload.

    The simulator publishes registers hr_100, hr_101, co_0, di_300.
    We map them to semantic fields (temperature, rpm, current_amp,
    heartbeat) per the spec/payload_spec_v1 hint.
    """
    # Coerce values. InfluxDB will not store booleans, so we treat any
    # non-numeric register as 0 and rely on the consumer to send the
    # right types.
    def _f(v) -> Optional[float]:
        if v is None:
            return None
        if isinstance(v, bool):
            return float(v)
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    def _i(v) -> Optional[int]:
        f = _f(v)
        return int(f) if f is not None else None

    temperature = _f(registers.get("hr_100"))
    if temperature is not None:
        temperature *= 0.1  # spec: scale 0.1°C
    rpm = _f(registers.get("hr_101"))
    current_amp = _f(registers.get("co_0"))
    if current_amp is not None:
        current_amp *= 0.1
    heartbeat = _i(registers.get("di_300"))

    # Determine operating status from any boolean register.
    operating = "running" if any(
        v is True for v in registers.values() if isinstance(v, bool)
    ) else "stopped"

    # Ensure gateway + plc exist before snapshot FK.
    g = _ensure_gateway(db, device_id, name=device_id, fw_version=fw_version)
    p = _ensure_plc(db, device_id, device_id, name=device_id)
    _ensure_assignment(db, device_id, device_id)
    g.status = "online"
    p.status = "online"
    p.operating_status = operating
    g.last_seen_ts = ts
    p.last_seen_ts = ts

    row = PLCSnapshot(
        plc_id=device_id,
        gateway_id=device_id,
        ts=ts,
        temperature=temperature,
        rpm=rpm,
        current_amp=current_amp,
        heartbeat=heartbeat,
        operating_status=operating,
        status="online",
        mode="normal",
    )
    db.add(row)
    db.commit()


def record_warning(
    db: Session,
    *,
    target_type: str,
    target_id: str,
    severity: str,
    code: str,
    message: Optional[str] = None,
    ts: Optional[int] = None,
) -> None:
    """Insert an active warning row (cleared=0)."""
    if severity not in ("info", "warning", "critical"):
        return
    if target_type not in ("plc", "gateway"):
        return
    row = Warning(
        target_type=target_type,
        target_id=target_id,
        severity=severity,
        code=code,
        message=message,
        ts=ts or _now(),
        cleared=0,
    )
    db.add(row)
    db.commit()