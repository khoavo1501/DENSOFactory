"""Payload builders per docs/99_attachments/payload_spec_v1.md.

All 5 categories share the same envelope (§1.1) and validate against
backend/master_protocol_v1.json. Builders here produce exactly the
JSON shape that schema accepts.

Hard rules enforced:
    - register keys only: hr_N / ir_N / co_N / di_N
    - registers count 1..200
    - reason / context are OMITTED when None (never null — schema drops)
    - event.code is one of the closed enum (§4.2)
    - 32-bit registers packed low-word first when produced (here we only
      produce pre-packed values for simplicity)
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .models import DeviceState


def _now_ts() -> int:
    return int(datetime.now(tz=timezone.utc).timestamp())


def _envelope(device_id: str, type_: str) -> dict[str, Any]:
    return {
        "device_id": device_id,
        "ts": _now_ts(),
        "type": type_,
    }


def telemetry(state: DeviceState, snapshot: dict[str, Any]) -> dict[str, Any]:
    """§2 telemetry payload."""
    return {
        **_envelope(state.device_id, "telemetry"),
        "seq": state.next_seq(),
        "fw": state.fw_version,
        "registers": snapshot,
    }


def status_online(state: DeviceState, now: float) -> dict[str, Any]:
    """§3 status payload (heartbeat)."""
    payload: dict[str, Any] = {
        **_envelope(state.device_id, "status"),
        "state": "online" if state.all_online() else "degraded",
        "uptime_s": state.uptime_s(now),
    }
    if not state.all_online():
        offline_ids = [p.id for p in state.plcs if not p.online]
        payload["reason"] = f"plcs_offline:{','.join(map(str, offline_ids))}"
    return payload


def status_offline(device_id: str, reason: str) -> dict[str, Any]:
    """§3 status offline payload (LWT or planned shutdown).

    For LWT: ts=0 (server replaces with receive time, see §3.2).
    For planned shutdown: ts=now (we just use normal timestamp).
    """
    is_lwt = reason == "unexpected_disconnect"
    return {
        "device_id": device_id,
        "ts": 0 if is_lwt else _now_ts(),
        "type": "status",
        "state": "offline",
        "reason": reason,
    }


def single_event(
    state: DeviceState,
    code: str,
    severity: str,
    message: str,
    source: str | None = None,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """§4 event payload (single event wrapped)."""
    item: dict[str, Any] = {
        "code": code,
        "severity": severity,
        "message": message[:256],
    }
    if source is not None:
        item["source"] = source[:64]
    if context is not None:
        item["context"] = context
    return {
        **_envelope(state.device_id, "event"),
        "events": [item],
    }


def info(state: DeviceState, ip: str, mac: str) -> dict[str, Any]:
    """§6 info payload. Published once after connect, retain=true."""
    payload = {
        **_envelope(state.device_id, "info"),
        "gateway": {
            "fw_version": state.fw_version,
            "hw_version": state.hw_version,
            "ip": ip,
            "mac": mac,
            "free_heap": 18432,
            "cpu_temp": 42.5,
            "reset_reason": state.reset_reason,
            "plcs": [
                {"id": p.id, "addr": p.addr, "name": p.name}
                for p in state.plcs
            ],
        },
    }
    return payload


def diag(state: DeviceState, now: float) -> dict[str, Any]:
    """§7 diag payload. Published every 5–15 minutes, QoS 0."""
    stats: dict[str, Any] = {
        "poll_cycle_ms": state.poll_cycle_ms,
        "uptime_s": state.uptime_s(now),
        "plcs": [
            {
                "id": p.id,
                "addr": p.addr,
                "ok": p.ok_count,
                "fail": p.fail_count,
                "last_ok_ts": p.last_ok_ts,
                "avg_latency_ms": p.avg_latency_ms,
            }
            for p in state.plcs
        ],
        "tx_packets": state.tx_packets,
        "tx_failures": state.tx_failures,
        "mqtt_reconnect": state.mqtt_reconnect,
        "avg_latency_ms": 10.2,
    }
    return {
        **_envelope(state.device_id, "diag"),
        "stats": stats,
    }


def ip_for(device_id: str) -> str:
    # deterministic-ish fake IP for demo only
    h = sum(ord(c) for c in device_id)
    return f"10.0.{(h % 250) + 1}.{(h * 7 % 250) + 1}"


def mac_for(device_id: str) -> str:
    h = sum(ord(c) for c in device_id) * 13
    return f"AA:BB:CC:{(h >> 8) & 0xFF:02X}:{(h >> 16) & 0xFF:02X}:{(h & 0xFF):02X}"