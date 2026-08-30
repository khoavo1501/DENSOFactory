"""Pydantic schemas shared across the API."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


# ====== Auth ======
class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    username: str
    role: str


# ====== Device source mapping ======
class DeviceSourceIn(BaseModel):
    source: str = Field(..., pattern="^(simulated|real)$")


class DeviceSourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    device_id: str
    source: str
    updated_at: datetime
    updated_by: Optional[str] = None


# ====== Telemetry / status / event ======
class TelemetryPoint(BaseModel):
    register: str
    value: Any
    ts: int


class StatusOut(BaseModel):
    # exclude_none: spec mục 3.3 forbids "reason": null; producer must
    # omit the field. Our response should also omit it rather than emit null.
    model_config = ConfigDict(exclude_none=True)

    state: str
    uptime_s: Optional[int] = None
    reason: Optional[str] = None
    ts: int


class EventOut(BaseModel):
    # spec mục 4.1 forbids "context": null. We never emit null fields.
    model_config = ConfigDict(exclude_none=True)

    ts: int
    code: str
    severity: str
    message: Optional[str] = None
    source: Optional[str] = None
    context: Optional[dict] = None
    device_id: str


class DiagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    device_id: str
    ts: int
    poll_cycle_ms: Optional[int] = None
    uptime_s: Optional[int] = None
    tx_packets: Optional[int] = None
    tx_failures: Optional[int] = None
    mqtt_reconnect: Optional[int] = None
    avg_latency_ms: Optional[float] = None


# ====== Devices list ======
class DeviceListItem(BaseModel):
    device_id: str
    source: str
    state: Optional[str] = None
    last_seen_ts: Optional[int] = None
    fw_version: Optional[str] = None


# ====== Simulator ======
class SimulatorStatus(BaseModel):
    running: bool
    device_ids: list[str] = []


# ====== Generic ======
class Page(BaseModel):
    page: int
    page_size: int
    total: int


class ExportTooLarge(Exception):
    pass
