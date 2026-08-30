"""Events feed: list, summary, detail."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user
from app.core.constants import VALID_EVENT_CODES, VALID_SEVERITIES
from app.db.session import get_db
from app.schemas.common import EventOut
from app.services.influx import get_influx, unix_to_iso
from app.utils.text import escape_flux_string

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=list[EventOut])
def list_events(
    device_id: Optional[str] = None,
    severity: Optional[str] = Query(default=None, pattern="^(info|warning|critical)(,(info|warning|critical))*$"),
    code: Optional[str] = Query(default=None, pattern=r"^[A-Z_]+(,[A-Z_]+)*$"),
    from_ts: int = Query(..., alias="from", ge=0),
    to_ts: int = Query(..., alias="to", ge=0),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    _: CurrentUser = Depends(get_current_user),
) -> list[EventOut]:
    if from_ts > to_ts:
        raise HTTPException(status_code=400, detail="from > to")

    if code:
        codes = [c for c in code.split(",") if c]
        invalid = [c for c in codes if c not in VALID_EVENT_CODES]
        if invalid:
            raise HTTPException(
                status_code=400,
                detail=f"invalid event codes: {invalid}",
            )

    influx_client = get_influx()
    bucket = escape_flux_string(influx_client._bucket)
    filters = [f'r._measurement == "device_event"']
    if device_id:
        filters.append(f'r.device_id == "{escape_flux_string(device_id)}"')
    if severity:
        sevs = [escape_flux_string(s) for s in severity.split(",")]
        sev_filter = " or ".join([f'r.severity == "{s}"' for s in sevs])
        filters.append(f"({sev_filter})")
    if code:
        codes_list = [escape_flux_string(c) for c in code.split(",")]
        code_filter = " or ".join([f'r.event_code == "{c}"' for c in codes_list])
        filters.append(f"({code_filter})")

    filter_str = "  |> ".join([f"filter(fn: (r) => {f})" for f in filters])
    offset = (page - 1) * page_size
    flux = f'''
from(bucket: "{bucket}")
  |> range(start: {unix_to_iso(from_ts)}, stop: {unix_to_iso(to_ts)})
  |> {filter_str}
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: {page_size}, offset: {offset})
'''
    rows = influx_client.query(flux)
    return [_row_to_event(r) for r in rows]


@router.get("/summary")
def event_summary(
    window: str = Query(default="24h", pattern=r"^\d+[mhd]$"),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    influx_client = get_influx()
    bucket = escape_flux_string(influx_client._bucket)
    flux = f'''
from(bucket: "{bucket}")
  |> range(start: -{window})
  |> filter(fn: (r) => r._measurement == "device_event")
  |> group(columns: ["severity", "event_code"])
  |> count()
'''
    rows = influx_client.query(flux)
    summary: dict[str, dict[str, int]] = {}
    for r in rows:
        sev = r.get("severity", "unknown")
        code = r.get("event_code", "unknown")
        summary.setdefault(sev, {})[code] = int(r.get("_value", 0))
    return summary


@router.get("/{event_id}")
def event_detail(
    event_id: str,
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    # InfluxDB v2 doesn't return stable IDs by default; use a synthetic
    # composite key (device_id-ts-code) for the M1 surface.
    return {"event_id": event_id, "note": "composite key in M1"}


def _row_to_event(r: dict) -> EventOut:
    return EventOut(
        ts=_iso_to_unix(r.get("_time", "")) or 0,
        code=r.get("event_code", ""),
        severity=r.get("severity", "info"),
        message=r.get("message") or r.get("_value"),
        device_id=r.get("device_id", ""),
    )


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
