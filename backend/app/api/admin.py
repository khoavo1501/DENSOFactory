"""Admin endpoints: source mapping CRUD, simulator control, user management (M5)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, require_admin
from app.core.security import hash_password
from app.db.session import get_db
from app.models import User as UserModel
from app.schemas.common import (
    DeviceSourceIn,
    DeviceSourceOut,
    SimulatorStatus,
    UserOut,
)
from app.services import audit, device_sources
from app.ws.hub import get_hub

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def _broadcast_source_changed(
    device_id: str, source: Optional[str], by: str
) -> None:
    """Broadcast source_changed on device + system channel.

    Called as a BackgroundTask from sync route handlers; runs on the
    main event loop so hub.publish (async) can be awaited directly.
    """
    import time as _time

    hub = get_hub()
    msg = {
        "type": "source_changed",
        "device_id": device_id,
        "source": source,
        "updated_by": by,
        "ts": int(_time.time()),
    }
    for channel in (device_id, "*"):
        await hub.publish(channel, msg)


# ====== User management (M5) ======
class UserCreateIn(BaseModel):
    username: str
    password: str
    role: str


class UserRoleIn(BaseModel):
    role: str


class UserPasswordIn(BaseModel):
    password: str


@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    return db.query(UserModel).order_by(UserModel.username).all()


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(
    body: UserCreateIn,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    if body.role not in ("admin", "viewer"):
        raise HTTPException(status_code=400, detail="invalid role")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="password too short (>=8)")
    if db.get(UserModel, body.username):
        raise HTTPException(status_code=409, detail="user already exists")
    u = UserModel(
        username=body.username,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(u)
    audit.write(
        db,
        action="admin.users.create",
        user_name=admin.username,
        target=body.username,
        detail={"role": body.role},
    )
    db.commit()
    db.refresh(u)
    return u


@router.patch("/users/{username}/role", response_model=UserOut)
def change_user_role(
    username: str,
    body: UserRoleIn,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    if body.role not in ("admin", "viewer"):
        raise HTTPException(status_code=400, detail="invalid role")
    u = db.get(UserModel, username)
    if not u:
        raise HTTPException(status_code=404, detail="user not found")
    if u.username == admin.username and body.role != "admin":
        raise HTTPException(
            status_code=400,
            detail="cannot demote the currently authenticated admin",
        )
    u.role = body.role
    audit.write(
        db,
        action="admin.users.role",
        user_name=admin.username,
        target=username,
        detail={"role": body.role},
    )
    db.commit()
    db.refresh(u)
    return u


@router.patch(
    "/users/{username}/password", status_code=204, response_class=Response
)
def change_user_password(
    username: str,
    body: UserPasswordIn,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="password too short (>=8)")
    u = db.get(UserModel, username)
    if not u:
        raise HTTPException(status_code=404, detail="user not found")
    u.password_hash = hash_password(body.password)
    audit.write(
        db,
        action="admin.users.password",
        user_name=admin.username,
        target=username,
    )
    db.commit()
    return Response(status_code=204)


@router.delete("/users/{username}", status_code=204, response_class=Response)
def delete_user(
    username: str,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    if username == admin.username:
        raise HTTPException(
            status_code=400, detail="cannot delete the currently authenticated user"
        )
    u = db.get(UserModel, username)
    if not u:
        raise HTTPException(status_code=404, detail="user not found")
    db.delete(u)
    audit.write(
        db,
        action="admin.users.delete",
        user_name=admin.username,
        target=username,
    )
    db.commit()
    return Response(status_code=204)


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
    background: BackgroundTasks,
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
    background.add_task(
        _broadcast_source_changed, device_id, body.source, user.username
    )
    return DeviceSourceOut.model_validate(row)


@router.delete(
    "/devices-sources/{device_id}",
    status_code=204,
    response_class=Response,
)
def delete_source(
    device_id: str,
    background: BackgroundTasks,
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
    background.add_task(
        _broadcast_source_changed, device_id, None, user.username
    )
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

