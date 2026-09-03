"""M10 API: gateways, plcs, unpaired, warnings."""
from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user
from app.db.session import get_db
from app.services import audit, plc as plc_service


router = APIRouter(prefix="/api", tags=["m10"])


# ====== Gateways ======
@router.get("/gateways")
def list_gateways(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    return plc_service.list_gateways(db)


@router.get("/gateways/{master_id}")
def get_gateway(
    master_id: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    gw = db.get(__import__("app.models.gateway", fromlist=["Gateway"]).Gateway, master_id)
    if gw is None:
        raise HTTPException(status_code=404, detail="gateway not found")
    plcs = plc_service.list_plcs(db, master_id)
    # Hydrate latest_snapshot + has_warning + highest_severity
    warnings = plc_service.list_warnings(db, target_type="plc")
    by_target = {w.target_id: w for w in warnings if not w.cleared}
    for plc in plcs:
        snap = plc_service.latest_snapshot(db, plc.plc_id)
        plc.latest_snapshot = snap
        w = by_target.get(plc.plc_id)
        plc.has_warning = w is not None
        plc.highest_severity = w.severity if w else None
    gw_dict = {
        "master_id": gw.master_id,
        "name": gw.name,
        "status": gw.status,
        "fw_version": gw.fw_version,
        "ip": gw.ip,
        "last_seen_ts": gw.last_seen_ts,
        "plcs": plcs,
        "has_warning": any(p.has_warning for p in plcs),
    }
    return gw_dict


@router.delete("/gateways/{master_id}", status_code=204)
def delete_gateway(
    master_id: str,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(get_current_user),
):
    from app.models.gateway import Gateway

    gw = db.get(Gateway, master_id)
    if gw is None:
        raise HTTPException(status_code=404, detail="gateway not found")
    db.delete(gw)
    audit.write(
        db,
        action="admin.gateways.delete",
        user_name=admin.username,
        target=master_id,
    )
    db.commit()
    return None


# ====== PLCs ======
@router.get("/plcs")
def list_plcs(
    gateway_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    plcs = plc_service.list_plcs(db, gateway_id)
    # Hydrate latest_snapshot + has_warning
    warnings = plc_service.list_warnings(db, target_type="plc")
    by_target = {w.target_id: w for w in warnings if not w.cleared}
    for plc in plcs:
        snap = plc_service.latest_snapshot(db, plc.plc_id)
        plc.latest_snapshot = snap
        w = by_target.get(plc.plc_id)
        plc.has_warning = w is not None
        plc.highest_severity = w.severity if w else None
    return plcs


@router.get("/plcs/{plc_id}")
def get_plc(
    plc_id: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    from app.models.gateway import PLC

    plc = db.get(PLC, plc_id)
    if plc is None:
        raise HTTPException(status_code=404, detail="plc not found")
    plc.latest_snapshot = plc_service.latest_snapshot(db, plc_id)
    warnings = plc_service.list_warnings(db, target_type="plc")
    w = next((x for x in warnings if x.target_id == plc_id and not x.cleared), None)
    plc.has_warning = w is not None
    plc.highest_severity = w.severity if w else None
    return plc


@router.get("/plcs/{plc_id}/snapshot")
def plc_snapshot(
    plc_id: str,
    mode: str = Query(default="normal", pattern="^(normal|realtime)$"),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    from app.models.gateway import PLC

    plc = db.get(PLC, plc_id)
    if plc is None:
        raise HTTPException(status_code=404, detail="plc not found")
    snap = plc_service.latest_snapshot(db, plc_id)
    if snap is None:
        raise HTTPException(status_code=404, detail="no snapshot available")
    # Tag mode at fetch time
    snap.mode = mode
    return snap


# ====== Unpaired ======
@router.get("/unpaired")
def list_unpaired(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    items = plc_service.list_unpaired(db)
    return items


class PairIn(BaseModel):
    gateway_id: str


@router.post("/unpaired/{plc_id}/pair", status_code=201)
def pair_plc(
    plc_id: str,
    body: PairIn,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(get_current_user),
):
    if not body.gateway_id:
        raise HTTPException(status_code=400, detail="gateway_id required")
    from app.models.gateway import Gateway, PLC

    plc = db.get(PLC, plc_id)
    if plc is None:
        raise HTTPException(status_code=404, detail="plc not found")
    gw = db.get(Gateway, body.gateway_id)
    if gw is None:
        raise HTTPException(
            status_code=400, detail=f"gateway {body.gateway_id} does not exist"
        )
    plc_service.pair_plc(db, plc_id, body.gateway_id)
    audit.write(
        db,
        action="admin.plc.pair",
        user_name=admin.username,
        target=plc_id,
        detail={"gateway_id": body.gateway_id},
    )
    db.commit()
    return {"plc_id": plc_id, "gateway_id": body.gateway_id, "ts": int(time.time())}


@router.delete("/unpaired/{plc_id}/pair", status_code=204)
def unpair_plc(
    plc_id: str,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(get_current_user),
):
    if not plc_service.unpair_plc(db, plc_id):
        raise HTTPException(status_code=404, detail="pairing not found")
    audit.write(
        db, action="admin.plc.unpair", user_name=admin.username, target=plc_id
    )
    db.commit()
    return None


# ====== Warnings ======
@router.get("/warnings")
def list_warnings(
    target_type: Optional[str] = Query(default=None, pattern="^(plc|gateway)$"),
    since: Optional[int] = Query(default=None, ge=0),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    return plc_service.list_warnings(db, target_type=target_type, since=since)


class WarningIn(BaseModel):
    target_type: str
    target_id: str
    severity: str
    code: str
    message: Optional[str] = None


@router.post("/warnings", status_code=201)
def raise_warning(
    body: WarningIn,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(get_current_user),
):
    if body.target_type not in ("plc", "gateway"):
        raise HTTPException(status_code=400, detail="target_type must be plc|gateway")
    if body.severity not in ("info", "warning", "critical"):
        raise HTTPException(
            status_code=400, detail="severity must be info|warning|critical"
        )
    w = plc_service.raise_warning(
        db,
        target_type=body.target_type,
        target_id=body.target_id,
        severity=body.severity,
        code=body.code,
        message=body.message or "",
    )
    audit.write(
        db,
        action="admin.warnings.raise",
        user_name=admin.username,
        target=f"{body.target_type}:{body.target_id}",
        detail={"severity": body.severity, "code": body.code},
    )
    db.commit()
    return w


@router.delete("/warnings/{warning_id}", status_code=204)
def clear_warning(
    warning_id: int,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(get_current_user),
):
    from app.models.gateway import Warning

    w = db.get(Warning, warning_id)
    if w is None:
        raise HTTPException(status_code=404, detail="warning not found")
    w.cleared = int(time.time())
    audit.write(
        db,
        action="admin.warnings.clear",
        user_name=admin.username,
        target=f"{w.target_type}:{w.target_id}",
        detail={"warning_id": w.id},
    )
    db.commit()
    return None
