"""PLC system service (M10).

Handles plc-system MQTT topic (gateway convention):
  plc-system/{master_id}/{status|telemetry}

Models:
  - Gateway: physical master (STM32 + W5500) with IP/MAC/firmware.
    One gateway can manage many PLCs.
  - PLC: virtual PLC attached to a gateway (1:1 with physical button
    in current firmware, but model allows 1:N for future).
  - PLCSnapshot: periodic snapshot of PLC values (1 per minute default,
    switch to realtime on warning).
  - Warning: events that put a PLC/Gateway in warning state.

Source mapping (M11): explicit `device_sources` table for devices/*
topic; plc-system is separate (no global table for M10, mapping
configured via assignment endpoints).
"""
from __future__ import annotations

import logging
import time
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.gateway import Gateway, PLCSnapshot, PLC, PLCAssignment, Warning
from app.services import audit


_log = logging.getLogger(__name__)

# Map master_id -> gateway_id (1 master = 1 gateway in M10)
def get_or_create_gateway(db: Session, master_id: str) -> Gateway:
    gw = db.get(Gateway, master_id)
    if gw is not None:
        return gw
    gw = Gateway(master_id=master_id, name=master_id, status="online")
    db.add(gw)
    db.commit()
    db.refresh(gw)
    return gw


def upsert_plc(
    db: Session,
    plc_id: str,
    master_id: str,
) -> PLC:
    plc = db.get(PLC, plc_id)
    if plc is None:
        plc = PLC(plc_id=plc_id, master_id=master_id)
        db.add(plc)
    else:
        plc.master_id = master_id
    db.commit()
    db.refresh(plc)
    return plc


# Update gateway status (online/offline from status topic)
def update_gateway_status(db: Session, master_id: str, status: str) -> Gateway:
    gw = get_or_create_gateway(db, master_id)
    if gw.status != status:
        gw.status = status
        gw.last_seen_ts = int(time.time())
        db.commit()
    return gw


# Update PLC operating_status from telemetry topic
def update_plc_telemetry(
    db: Session,
    plc_id: str,
    master_id: str,
    payload: dict,
) -> PLC:
    gw = get_or_create_gateway(db, master_id)
    plc = upsert_plc(db, plc_id, master_id)
    plc.operating_status = payload.get("operating_status", plc.operating_status)
    plc.status = payload.get("status", plc.status)
    plc.last_seen_ts = int(time.time())
    db.commit()
    return plc


# Save snapshot (1 row per plc per snapshot)
def save_snapshot(
    db: Session,
    plc_id: str,
    master_id: str,
    payload: dict,
) -> PLCSnapshot:
    snap = PLCSnapshot(
        plc_id=plc_id,
        master_id=master_id,
        ts=int(time.time()),
        temperature=payload.get("temperature"),
        rpm=payload.get("rpm"),
        current_amp=payload.get("current_amp"),
        heartbeat=payload.get("heartbeat"),
        operating_status=payload.get("operating_status"),
        status=payload.get("status"),
    )
    db.add(snap)
    db.commit()
    db.refresh(snap)
    return snap


def latest_snapshot(db: Session, plc_id: str) -> Optional[PLCSnapshot]:
    row = db.execute(
        select(PLCSnapshot)
        .where(PLCSnapshot.plc_id == plc_id)
        .order_by(PLCSnapshot.ts.desc())
        .limit(1)
    ).scalar_one_or_none()
    return row


# Warning: raise + clear
def raise_warning(
    db: Session,
    *,
    target_type: str,  # "plc" or "gateway"
    target_id: str,
    severity: str,
    code: str,
    message: str,
) -> Warning:
    w = Warning(
        target_type=target_type,
        target_id=target_id,
        severity=severity,
        code=code,
        message=message,
        ts=int(time.time()),
    )
    db.add(w)
    audit.write(
        db,
        action=f"warning.raise.{target_type}",
        target=target_id,
        detail={"severity": severity, "code": code, "message": message},
    )
    db.commit()
    db.refresh(w)
    return w


def clear_warnings_for_target(
    db: Session, target_type: str, target_id: str
) -> int:
    rows = db.execute(
        select(Warning)
        .where(Warning.target_type == target_type, Warning.target_id == target_id)
    ).scalars()
    n = 0
    for r in rows:
        db.delete(r)
        n += 1
    if n:
        audit.write(
            db,
            action=f"warning.clear.{target_type}",
            target=target_id,
            detail={"cleared": n},
        )
        db.commit()
    return n


# Listing endpoints
def list_gateways(db: Session) -> list[Gateway]:
    return list(db.execute(select(Gateway).order_by(Gateway.master_id)).scalars())


def list_plcs(db: Session, gateway_id: Optional[str] = None) -> list[PLC]:
    q = select(PLC).order_by(PLC.plc_id)
    if gateway_id:
        q = q.where(PLC.master_id == gateway_id)
    return list(db.execute(q).scalars())


def list_unpaired(db: Session) -> list[dict]:
    """Return PLCs that have no PLCAssignment row, with latest snapshot.

    Simpler approach: get all PLCs, filter paired ones, attach latest
    snapshot per PLC. Avoids SQLAlchemy auto-correlation issue.
    """
    all_plcs = list(db.execute(select(PLC).order_by(PLC.plc_id)).scalars())
    paired_ids = set(
        db.execute(select(PLCAssignment.plc_id)).scalars()
    )
    out: list[dict] = []
    for plc in all_plcs:
        if plc.plc_id in paired_ids:
            continue
        snap = latest_snapshot(db, plc.plc_id)
        out.append(
            {
                "plc_id": plc.plc_id,
                "master_id": plc.master_id,
                "last_seen_ts": plc.last_seen_ts,
                "latest_snapshot": {
                    "temperature": snap.temperature if snap else None,
                    "rpm": snap.rpm if snap else None,
                    "current_amp": snap.current_amp if snap else None,
                    "heartbeat": snap.heartbeat if snap else None,
                    "operating_status": snap.operating_status if snap else None,
                }
                if snap
                else None,
            }
        )
    return out


def list_warnings(
    db: Session, target_type: Optional[str] = None, since: Optional[int] = None
) -> list[Warning]:
    q = select(Warning).order_by(Warning.ts.desc())
    if target_type:
        q = q.where(Warning.target_type == target_type)
    if since:
        q = q.where(Warning.ts >= since)
    return list(db.execute(q).scalars())


# Pair/unpair
def pair_plc(db: Session, plc_id: str, gateway_id: str) -> PLCAssignment:
    existing = db.execute(
        select(PLCAssignment).where(PLCAssignment.plc_id == plc_id)
    ).scalar_one_or_none()
    if existing:
        existing.gateway_id = gateway_id
    else:
        existing = PLCAssignment(plc_id=plc_id, gateway_id=gateway_id)
        db.add(existing)
    db.commit()
    db.refresh(existing)
    return existing


def unpair_plc(db: Session, plc_id: str) -> bool:
    existing = db.execute(
        select(PLCAssignment).where(PLCAssignment.plc_id == plc_id)
    ).scalar_one_or_none()
    if existing is None:
        return False
    db.delete(existing)
    db.commit()
    return True
