"""Export endpoints: telemetry / events / diag as CSV or XLSX.

Enforces EXPORT_MAX_ROWS limit (default 100_000). Over -> 413.
"""
from __future__ import annotations

import io
from datetime import datetime
from typing import Literal, Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models import DeviceDiag
from app.services import audit
from app.services.influx import get_influx, unix_to_iso
from app.utils.text import escape_flux_string

router = APIRouter(prefix="/api/exports", tags=["exports"])


def _df_to_csv(df: pd.DataFrame) -> StreamingResponse:
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="export.csv"'},
    )


def _df_to_xlsx(df: pd.DataFrame) -> StreamingResponse:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="data")
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="export.xlsx"'},
    )


def _enforce_limit(row_count: int) -> None:
    max_rows = get_settings().EXPORT_MAX_ROWS
    if row_count > max_rows:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"export exceeds limit ({row_count} > {max_rows}); narrow range",
        )


# ====== Telemetry ======
@router.get("/telemetry")
def export_telemetry(
    device_id: str,
    register: str,
    from_ts: int = Query(..., alias="from", ge=0),
    to_ts: int = Query(..., alias="to", ge=0),
    format: Literal["csv", "xlsx"] = "csv",
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    influx_client = get_influx()
    bucket = escape_flux_string(influx_client._bucket)
    did = escape_flux_string(device_id)
    reg = escape_flux_string(register)
    flux = f'''
from(bucket: "{bucket}")
  |> range(start: {unix_to_iso(from_ts)}, stop: {unix_to_iso(to_ts)})
  |> filter(fn: (r) => r._measurement == "device_telemetry")
  |> filter(fn: (r) => r.device_id == "{did}")
  |> filter(fn: (r) => r.register == "{reg}")
'''
    rows = influx_client.query(flux)
    _enforce_limit(len(rows))

    audit.write(
        db,
        action="export.telemetry",
        user_name=user.username,
        target=device_id,
        detail={
            "format": format,
            "register": register,
            "from_ts": from_ts,
            "to_ts": to_ts,
            "row_count": len(rows),
        },
    )
    db.commit()

    df = pd.DataFrame(rows)
    return _df_to_csv(df) if format == "csv" else _df_to_xlsx(df)


# ====== Events ======
@router.get("/events")
def export_events(
    from_ts: int = Query(..., alias="from", ge=0),
    to_ts: int = Query(..., alias="to", ge=0),
    device_id: Optional[str] = None,
    severity: Optional[str] = None,
    code: Optional[str] = None,
    format: Literal["csv", "xlsx"] = "csv",
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    influx_client = get_influx()
    bucket = escape_flux_string(influx_client._bucket)
    filters = ['r._measurement == "device_event"']
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
    flux = f'''
from(bucket: "{bucket}")
  |> range(start: {unix_to_iso(from_ts)}, stop: {unix_to_iso(to_ts)})
  |> {filter_str}
'''
    rows = influx_client.query(flux)
    _enforce_limit(len(rows))

    audit.write(
        db,
        action="export.events",
        user_name=user.username,
        detail={
            "format": format,
            "device_id": device_id,
            "severity": severity,
            "code": code,
            "from_ts": from_ts,
            "to_ts": to_ts,
            "row_count": len(rows),
        },
    )
    db.commit()

    df = pd.DataFrame(rows)
    return _df_to_csv(df) if format == "csv" else _df_to_xlsx(df)


# ====== Diag ======
@router.get("/diag")
def export_diag(
    device_id: str,
    from_ts: int = Query(..., alias="from", ge=0),
    to_ts: int = Query(..., alias="to", ge=0),
    format: Literal["csv", "xlsx"] = "csv",
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(DeviceDiag)
        .where(DeviceDiag.device_id == device_id)
        .where(DeviceDiag.ts >= from_ts)
        .where(DeviceDiag.ts <= to_ts)
        .order_by(DeviceDiag.ts)
    ).scalars()
    data = [
        {
            "device_id": r.device_id,
            "ts": r.ts,
            "poll_cycle_ms": r.poll_cycle_ms,
            "uptime_s": r.uptime_s,
            "tx_packets": r.tx_packets,
            "tx_failures": r.tx_failures,
            "mqtt_reconnect": r.mqtt_reconnect,
            "avg_latency_ms": r.avg_latency_ms,
        }
        for r in rows
    ]
    _enforce_limit(len(data))

    audit.write(
        db,
        action="export.diag",
        user_name=user.username,
        target=device_id,
        detail={
            "format": format,
            "from_ts": from_ts,
            "to_ts": to_ts,
            "row_count": len(data),
        },
    )
    db.commit()

    df = pd.DataFrame(data)
    return _df_to_csv(df) if format == "csv" else _df_to_xlsx(df)
