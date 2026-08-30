"""Admin endpoints: source mapping CRUD, simulator control."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, require_admin
from app.db.session import get_db
from app.schemas.common import (
    DeviceSourceIn,
    DeviceSourceOut,
    SimulatorStatus,
)
from app.services import audit, device_sources

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ====== Device source mapping ======
@router.get("/devices-sources", response_model=list[DeviceSourceOut])
def list_sources(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
) -> list[DeviceSourceOut]:
    rows = device_sources.list_all(db)
    return [DeviceSourceOut.model_validate(r) for r in rows]


@router.put(
    "/devices-sources/{device_id}",
    response_model=DeviceSourceOut,
)
def upsert_source(
    device_id: str,
    body: DeviceSourceIn,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_admin),
) -> DeviceSourceOut:
    try:
        row = device_sources.upsert(
            db, device_id, body.source, updated_by=user.username
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    audit.write(
        db,
        action="admin.sources.upsert",
        user_name=user.username,
        target=device_id,
        detail={"source": body.source},
    )
    db.commit()
    return DeviceSourceOut.model_validate(row)


@router.delete(
    "/devices-sources/{device_id}",
    status_code=204,
    response_class=Response,
)
def delete_source(
    device_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_admin),
) -> Response:
    if not device_sources.delete(db, device_id):
        raise HTTPException(status_code=404, detail="mapping not found")
    audit.write(
        db,
        action="admin.sources.delete",
        user_name=user.username,
        target=device_id,
    )
    db.commit()
    return Response(status_code=204)


# ====== Simulator control ======
_sim_state: dict[str, Optional[str]] = {"proc": None, "device_ids": []}


@router.get("/simulator/status", response_model=SimulatorStatus)
def sim_status(_: CurrentUser = Depends(require_admin)) -> SimulatorStatus:
    running = _sim_state["proc"] is not None
    return SimulatorStatus(
        running=running, device_ids=_sim_state["device_ids"] or []
    )


@router.post("/simulator/start", response_model=SimulatorStatus)
def sim_start(
    body: Optional[dict] = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_admin),
) -> SimulatorStatus:
    if _sim_state["proc"] is not None:
        raise HTTPException(status_code=409, detail="simulator already running")
    device_ids = (body or {}).get("device_ids") or []
    audit.write(
        db,
        action="admin.simulator.start",
        user_name=user.username,
        detail={"device_ids": device_ids},
    )
    db.commit()
    # In a full implementation, this would launch a docker container
    # or subprocess running simulator/simulator.py. For M1 we mark intent
    # and rely on the actual orchestrator (docker-compose) to start the
    # simulator container; the webapp toggle is the user-facing switch.
    _sim_state["proc"] = "external"
    _sim_state["device_ids"] = device_ids
    return SimulatorStatus(
        running=True, device_ids=_sim_state["device_ids"]
    )


@router.post("/simulator/stop", response_model=SimulatorStatus)
def sim_stop(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_admin),
) -> SimulatorStatus:
    if _sim_state["proc"] is None:
        raise HTTPException(status_code=409, detail="simulator not running")
    audit.write(
        db,
        action="admin.simulator.stop",
        user_name=user.username,
        target=_sim_state["proc"],
    )
    db.commit()
    _sim_state["proc"] = None
    _sim_state["device_ids"] = []
    return SimulatorStatus(running=False, device_ids=[])
