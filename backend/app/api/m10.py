"""M10: Gateway / PLC / Warning endpoints.

Data sources:
- `gateways`, `plcs`, `plc_assignments`, `warnings` — Postgres (M10 tables).
- `plc_snapshots` — Postgres, written by the consumer; latest is queried
  per PLC at request time.

This module does NOT query InfluxDB — that's where the bulk telemetry
history lives, but live state and metadata come from Postgres.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user
from app.db.session import get_db
from app.models import (
    Gateway,
    PLC,
    PLCAssignment,
    PLCSnapshot as SnapshotModel,
    Warning,
)
from app.schemas.common import (
    GatewayOut,
    GatewayWithPLCs,
    PLCSnapshot,
    PLCOut,
    PairRequest,
    WarningOut,
)

_log = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["m10"])


# ====== Helpers ======
def _latest_snapshot(db: Session, plc_id: str) -> Optional[PLCSnapshot]:
    row = db.execute(
        select(SnapshotModel)
        .where(SnapshotModel.plc_id == plc_id)
        .order_by(SnapshotModel.ts.desc())
        .limit(1)
    ).scalar_one_or_none()
    if row is None:
        return None
    return PLCSnapshot.model_validate(
        {
            "temperature": row.temperature,
            "rpm": row.rpm,
            "current_amp": row.current_amp,
            "heartbeat": row.heartbeat,
            "operating_status": row.operating_status,
            "status": row.status,
            "mode": row.mode,
            "ts": row.ts,
        }
    )


def _build_plc_out(db: Session, plc: PLC) -> PLCOut:
    snap = _latest_snapshot(db, plc.plc_id)
    return PLCOut(
        plc_id=plc.plc_id,
        gateway_id=plc.gateway_id,
        name=plc.name,
        operating_status=plc.operating_status,
        status=plc.status,
        last_seen_ts=plc.last_seen_ts,
        latest_snapshot=snap,
    )


# ====== Gateways ======
@router.get("/gateways", response_model=list[GatewayOut])
def list_gateways(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> list[GatewayOut]:
    rows = db.execute(select(Gateway).order_by(Gateway.name)).scalars().all()
    return [GatewayOut.model_validate(g) for g in rows]


@router.get("/gateways/{gateway_id}", response_model=GatewayWithPLCs)
def get_gateway(
    gateway_id: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> GatewayWithPLCs:
    g = db.get(Gateway, gateway_id)
    if not g:
        raise HTTPException(status_code=404, detail="gateway not found")
    plcs = db.execute(
        select(PLC)
        .where(PLC.gateway_id == gateway_id)
        .order_by(PLC.plc_id)
    ).scalars().all()
    return GatewayWithPLCs(
        gateway_id=g.gateway_id,
        name=g.name,
        status=g.status,
        fw_version=g.fw_version,
        ip=g.ip,
        last_seen_ts=g.last_seen_ts,
        plcs=[_build_plc_out(db, p) for p in plcs],
    )


# ====== PLCs ======
@router.get("/plcs", response_model=list[PLCOut])
def list_plcs(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> list[PLCOut]:
    rows = db.execute(
        select(PLC).order_by(PLC.gateway_id, PLC.plc_id)
    ).scalars().all()
    return [_build_plc_out(db, p) for p in rows]


@router.get("/plcs/unpaired", response_model=list[PLCOut])
def list_unpaired_plcs(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> list[PLCOut]:
    """PLCs not in `plc_assignments` (no current gateway binding)."""
    paired_subq = select(PLCAssignment.plc_id)
    rows = db.execute(
        select(PLC)
        .where(PLC.plc_id.notin_(paired_subq))
        .order_by(PLC.plc_id)
    ).scalars().all()
    return [_build_plc_out(db, p) for p in rows]


@router.get("/plcs/{plc_id}", response_model=PLCOut)
def get_plc(
    plc_id: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> PLCOut:
    p = db.get(PLC, plc_id)
    if not p:
        raise HTTPException(status_code=404, detail="plc not found")
    return _build_plc_out(db, p)


@router.get("/plcs/{plc_id}/history")
def plc_history(
    plc_id: str,
    register: str = Query(..., min_length=1, max_length=32),
    from_ts: int = Query(..., alias="from", ge=0),
    to_ts: int = Query(..., alias="to", ge=0),
    limit: int = Query(default=2000, ge=1, le=10000),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> list[dict]:
    """Return time-series of a single register from `plc_snapshots`.

    `register` must be one of: temperature, rpm, current_amp, heartbeat.
    Returns rows in `{_time, _value}` shape so the webapp reuses the
    same parsing it uses for InfluxDB.
    """
    if from_ts > to_ts:
        raise HTTPException(status_code=400, detail="from > to")
    p = db.get(PLC, plc_id)
    if not p:
        raise HTTPException(status_code=404, detail="plc not found")
    column_attr = {
        "temperature": "temperature",
        "rpm": "rpm",
        "current_amp": "current_amp",
        "heartbeat": "heartbeat",
    }.get(register)
    if column_attr is None:
        raise HTTPException(
            status_code=400,
            detail=f"unknown register {register!r}; must be one of "
            "temperature, rpm, current_amp, heartbeat",
        )
    col = getattr(SnapshotModel, column_attr)
    rows = (
        db.execute(
            select(SnapshotModel.ts, col)
            .where(SnapshotModel.plc_id == plc_id)
            .where(SnapshotModel.ts >= from_ts)
            .where(SnapshotModel.ts <= to_ts)
            .order_by(SnapshotModel.ts.asc())
            .limit(limit)
        )
        .all()
    )
    from datetime import datetime, timezone
    out: list[dict] = []
    for r in rows:
        ts_val = r[0]
        val = r[1]
        iso = datetime.fromtimestamp(ts_val, tz=timezone.utc).isoformat().replace(
            "+00:00", "Z"
        )
        out.append({"_time": iso, "_value": str(val) if val is not None else ""})
    return out


@router.post("/plcs/{plc_id}/pair")
def pair_plc(
    plc_id: str,
    body: PairRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    p = db.get(PLC, plc_id)
    if not p:
        raise HTTPException(status_code=404, detail="plc not found")
    g = db.get(Gateway, body.gateway_id)
    if not g:
        raise HTTPException(status_code=404, detail="gateway not found")
    # Update PLC.gateway_id and create/update assignment row.
    p.gateway_id = body.gateway_id
    existing = db.execute(
        select(PLCAssignment).where(PLCAssignment.plc_id == plc_id)
    ).scalar_one_or_none()
    if existing:
        existing.gateway_id = body.gateway_id
    else:
        db.add(
            PLCAssignment(plc_id=plc_id, gateway_id=body.gateway_id)
        )
    db.commit()
    return {"ok": True, "plc_id": p.plc_id, "gateway_id": p.gateway_id}


# ====== Warnings ======
@router.get("/warnings", response_model=list[WarningOut])
def list_warnings(
    since: Optional[int] = Query(default=None, ge=0),
    target_type: Optional[str] = Query(default=None, pattern="^(gateway|plc)$"),
    target_id: Optional[str] = Query(default=None, max_length=128),
    include_cleared: bool = Query(default=False),
    limit: int = Query(default=200, ge=1, le=2000),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> list[WarningOut]:
    """Active (cleared=0) warnings by default.

    The webapp uses this for the "active warnings" stat card and the
    per-gateway warning panel.
    """
    q = select(Warning).order_by(Warning.ts.desc()).limit(limit)
    if since is not None:
        q = q.where(Warning.ts >= since)
    if target_type:
        q = q.where(Warning.target_type == target_type)
    if target_id:
        q = q.where(Warning.target_id == target_id)
    if not include_cleared:
        q = q.where(Warning.cleared == 0)  # noqa: E712
    rows = db.execute(q).scalars().all()
    return [WarningOut.model_validate(r) for r in rows]
