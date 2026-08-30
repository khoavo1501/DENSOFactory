"""Devices listing, latest, telemetry snapshot/history, diag."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user
from app.db.session import get_db
from app.models import DeviceDiag
from app.schemas.common import (
    DiagOut,
    TelemetryPoint,
)
from app.services import device_sources, influx
from app.services.influx import get_influx, unix_to_iso
from app.utils.text import escape_flux_string

router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.get("")
def list_devices(
    source: Optional[str] = Query(default=None, pattern="^(simulated|real)$"),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> list[dict]:
    """List devices with source/state/last_seen.

    Reads from a virtual 'devices' view assembled from InfluxDB tags.
    For M1 we use Postgres + a lightweight heuristic. A real device
    registry can be added later (e.g. derived from info publishes).
    """
    influx_client = get_influx()
    bucket_esc = escape_flux_string(influx_client._bucket)
    flux = f'''
from(bucket: "{bucket_esc}")
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "device_status")
  |> last()
  |> keep(columns: ["device_id","state","_time"])
'''
    rows = influx_client.query(flux)

    seen: dict[str, dict] = {}
    for r in rows:
        did = r.get("device_id")
        if not did:
            continue
        seen[did] = {
            "device_id": did,
            "source": device_sources.resolve_source(db, did),
            "state": r.get("state") or r.get("_value"),
            "last_seen_ts": _iso_to_unix(r.get("_time", "")),
        }
    out = list(seen.values())
    if source:
        out = [d for d in out if d["source"] == source]
    return out


@router.get("/{device_id}/latest")
def device_latest(
    device_id: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    return {
        "device_id": device_id,
        "source": device_sources.resolve_source(db, device_id),
        "status": _influx_latest_status(device_id),
        "telemetry": _influx_latest_telemetry(device_id),
    }


@router.get("/{device_id}/telemetry/snapshot")
def telemetry_snapshot(
    device_id: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    return {
        "device_id": device_id,
        "source": device_sources.resolve_source(db, device_id),
        "registers": _influx_latest_telemetry(device_id),
    }


@router.get("/{device_id}/telemetry/history")
def telemetry_history(
    device_id: str,
    register: str = Query(..., min_length=1, max_length=64),
    from_ts: int = Query(..., alias="from", ge=0),
    to_ts: int = Query(..., alias="to", ge=0),
    agg: Optional[str] = Query(default="raw", pattern="^(raw|1m|5m|1h)$"),
    _: CurrentUser = Depends(get_current_user),
) -> list[dict]:
    if from_ts > to_ts:
        raise HTTPException(status_code=400, detail="from > to")
    influx_client = get_influx()
    bucket = escape_flux_string(influx_client._bucket)
    did = escape_flux_string(device_id)
    reg = escape_flux_string(register)
    window = {
        "raw": '|> aggregateWindow(every: 1s, fn: last, createEmpty: false)',
        "1m": '|> aggregateWindow(every: 1m, fn: mean, createEmpty: false)',
        "5m": '|> aggregateWindow(every: 5m, fn: mean, createEmpty: false)',
        "1h": '|> aggregateWindow(every: 1h, fn: mean, createEmpty: false)',
    }[agg]
    flux = f'''
from(bucket: "{bucket}")
  |> range(start: {unix_to_iso(from_ts)}, stop: {unix_to_iso(to_ts)})
  |> filter(fn: (r) => r._measurement == "device_telemetry")
  |> filter(fn: (r) => r.device_id == "{did}")
  |> filter(fn: (r) => r.register == "{reg}")
  {window}
'''
    return influx_client.query(flux)


# ====== Diag (Postgres) ======
@router.get("/{device_id}/diag/latest", response_model=Optional[DiagOut])
def diag_latest(
    device_id: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> Optional[DiagOut]:
    row = db.execute(
        select(DeviceDiag)
        .where(DeviceDiag.device_id == device_id)
        .order_by(DeviceDiag.ts.desc())
        .limit(1)
    ).scalar_one_or_none()
    return DiagOut.model_validate(row) if row else None


@router.get("/{device_id}/diag/history", response_model=list[DiagOut])
def diag_history(
    device_id: str,
    from_ts: int = Query(..., alias="from", ge=0),
    to_ts: int = Query(..., alias="to", ge=0),
    limit: int = Query(default=500, ge=1, le=5000),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> list[DiagOut]:
    rows = db.execute(
        select(DeviceDiag)
        .where(DeviceDiag.device_id == device_id)
        .where(DeviceDiag.ts >= from_ts)
        .where(DeviceDiag.ts <= to_ts)
        .order_by(DeviceDiag.ts.desc())
        .limit(limit)
    ).scalars()
    return [DiagOut.model_validate(r) for r in rows]


# ====== helpers ======
def _influx_latest_status(device_id: str) -> Optional[dict]:
    influx_client = get_influx()
    did = escape_flux_string(device_id)
    flux = f'''
from(bucket: "{escape_flux_string(influx_client._bucket)}")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "device_status")
  |> filter(fn: (r) => r.device_id == "{did}")
  |> last()
'''
    rows = influx_client.query(flux)
    if not rows:
        return None
    r = rows[0]
    return {
        "state": r.get("state") or r.get("_value"),
        "uptime_s": int(r.get("uptime_s", 0)) if r.get("uptime_s") else None,
        "ts": _iso_to_unix(r.get("_time", "")) or 0,
    }


def _influx_latest_telemetry(device_id: str) -> dict:
    influx_client = get_influx()
    did = escape_flux_string(device_id)
    flux = f'''
from(bucket: "{escape_flux_string(influx_client._bucket)}")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == "device_telemetry")
  |> filter(fn: (r) => r.device_id == "{did}")
  |> last()
'''
    rows = influx_client.query(flux)
    out: dict[str, dict] = {}
    for r in rows:
        reg = r.get("register")
        if not reg:
            continue
        out[reg] = {
            "value": _coerce_value(r.get("_value")),
            "ts": _iso_to_unix(r.get("_time", "")) or 0,
        }
    return out


def _coerce_value(s: str) -> object:
    if s is None:
        return None
    if s in ("true", "false"):
        return s == "true"
    try:
        if "." in s:
            return float(s)
        return int(s)
    except Exception:
        return s


def _iso_to_unix(iso: str) -> Optional[int]:
    if not iso:
        return None
    try:
        from datetime import datetime
        if iso.endswith("Z"):
            iso = iso[:-1] + "+00:00"
        return int(datetime.fromisoformat(iso).timestamp())
    except Exception:
        return None
