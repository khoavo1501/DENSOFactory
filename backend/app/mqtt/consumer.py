"""MQTT consumer: validate per master_protocol_v1.json and dispatch.

Spec mục 8.1: backend reads JSON schema on every message; schema file
is volume-mounted so editing it takes effect without restart.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import aiomqtt
from jsonschema import Draft202012Validator
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.mqtt.dispatch import (
    handle_diag,
    handle_event,
    handle_status,
    handle_telemetry,
)


_log = logging.getLogger(__name__)

SCHEMA_PATH = os.environ.get(
    "MASTER_PROTOCOL_SCHEMA", "/app/master_protocol_v1.json"
)


class SchemaLoader:
    """Reload JSON schema from disk on every call (spec mục 7.1)."""

    def __init__(self, path: str) -> None:
        self._path = path
        self._mtime: Optional[float] = None
        self._validator: Optional[Draft202012Validator] = None

    def get(self) -> Draft202012Validator:
        try:
            mtime = os.path.getmtime(self._path)
        except FileNotFoundError:
            _log.error("schema file not found: %s", self._path)
            if self._validator is None:
                raise RuntimeError(f"schema missing and not loaded: {self._path}")
            return self._validator

        if self._validator is None or mtime != self._mtime:
            with open(self._path) as f:
                schema = json.load(f)
            self._validator = Draft202012Validator(schema)
            self._mtime = mtime
            _log.info("schema reloaded from %s (mtime=%s)", self._path, mtime)
        return self._validator


def _now() -> int:
    return int(datetime.now(tz=timezone.utc).timestamp())


def _dispatch(db: Session, category: str, payload: dict) -> None:
    if category == "telemetry":
        handle_telemetry(db, payload)
    elif category == "status":
        handle_status(db, payload)
    elif category == "event":
        handle_event(db, payload)
    elif category == "diag":
        handle_diag(db, payload)
    elif category == "info":
        # spec mục 8.2: info chỉ log; we just log fw_version
        fw = (payload.get("gateway") or {}).get("fw_version")
        _log.info("info: device_id=%s fw_version=%s", payload.get("device_id"), fw)
    else:
        _log.warning("unknown category %r; drop", category)


def _write_to_influx_sync(category: str, payload: dict) -> None:
    """Synchronous InfluxDB writer.

    For telemetry/status/event we record into the appropriate measurement
    via a blocking write. This is called from the consumer thread via
    run_in_executor to keep aiomqtt non-blocking.
    """
    from app.services.influx import get_influx
    import httpx

    settings = get_settings()
    if not settings.INFLUXDB_TOKEN:
        return
    influx = get_influx()
    base = settings.INFLUXDB_URL.rstrip("/")
    org = settings.INFLUXDB_ORG
    bucket = settings.INFLUXDB_BUCKET
    token = settings.INFLUXDB_TOKEN

    device_id = payload.get("device_id", "")
    # Spec mục 3.2: LWT uses ts=0; server replaces with receive time.
    raw_ts = int(payload.get("ts", 0) or 0)
    if raw_ts <= 0:
        raw_ts = _now()
    ts_ns = raw_ts * 1_000_000_000

    lines: list[str] = []
    if category == "telemetry":
        regs = payload.get("registers", {})
        for reg, value in regs.items():
            if isinstance(value, bool):
                # Cast bool to int (0/1) to avoid field type conflict in
                # InfluxDB when a register alternates bool/int values.
                v = "1i" if value else "0i"
            elif isinstance(value, int):
                v = f"{value}i"
            else:
                v = str(value)
            lines.append(
                f"device_telemetry,device_id={device_id},register={reg} "
                f"value={v} {ts_ns}"
            )
    elif category == "status":
        state = payload.get("state", "")
        uptime = payload.get("uptime_s") or 0
        lines.append(
            f"device_status,device_id={device_id},state={state} "
            f"uptime_s={int(uptime)}i {ts_ns}"
        )
    elif category == "event":
        for ev in payload.get("events", []):
            code = ev.get("code", "")
            sev = ev.get("severity", "")
            msg = (ev.get("message") or "").replace(" ", "\\ ")
            lines.append(
                f"device_event,device_id={device_id},event_code={code},"
                f"severity={sev} message=\"{msg}\" {ts_ns}"
            )

    if not lines:
        return
    try:
        with httpx.Client(timeout=5.0) as client:
            r = client.post(
                f"{base}/api/v2/write",
                params={"org": org, "bucket": bucket, "precision": "ns"},
                headers={
                    "Authorization": f"Token {token}",
                    "Content-Type": "text/plain",
                },
                content="\n".join(lines),
            )
            if r.status_code >= 300:
                _log.warning("influx write %d: %s", r.status_code, r.text[:200])
    except Exception as e:
        _log.warning("influx write failed: %s", e)


async def _run_influx_write(category: str, payload: dict) -> None:
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _write_to_influx_sync, category, payload)


async def _on_message(
    loader: SchemaLoader,
    msg: aiomqtt.Message,
) -> None:
    topic = msg.topic.value if hasattr(msg.topic, "value") else str(msg.topic)
    raw = msg.payload
    if raw is None:
        _log.warning("empty payload on %s; drop", topic)
        return

    # Parse topic: devices/{device_id}/{category}
    parts = topic.split("/")
    if len(parts) != 3 or parts[0] != "devices":
        _log.warning("topic %r does not match devices/{id}/{cat}; drop", topic)
        return
    _, topic_device_id, topic_category = parts

    # Parse JSON
    try:
        payload = json.loads(raw)
    except Exception as e:
        _log.warning("json parse failed for %s: %s; drop", topic, e)
        return

    if not isinstance(payload, dict):
        _log.warning("payload not an object on %s; drop", topic)
        return

    # Envelope integrity
    if payload.get("device_id") != topic_device_id:
        _log.warning(
            "device_id mismatch topic=%s payload=%s; drop",
            topic_device_id,
            payload.get("device_id"),
        )
        return

    # Validate schema (oneOf picks the right branch)
    validator = loader.get()
    errors = list(validator.iter_errors(payload))
    if errors:
        _log.warning("schema validation failed for %s: %s; drop", topic, errors[0].message)
        return

    # Dispatch (DB writes + WS broadcast)
    db = SessionLocal()
    try:
        _dispatch(db, topic_category, payload)
    except Exception as e:
        _log.exception("dispatch failed for %s: %s", topic, e)
    finally:
        db.close()

    # InfluxDB write (async, non-blocking)
    if topic_category in ("telemetry", "status", "event"):
        try:
            await _run_influx_write(topic_category, payload)
        except Exception as e:
            _log.warning("influx write task failed: %s", e)


class Consumer:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._loader = SchemaLoader(SCHEMA_PATH)
        self._task: Optional[asyncio.Task] = None
        self._stop = asyncio.Event()

    async def start(self) -> None:
        if self._task is not None:
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._loop(), name="mqtt-consumer")

    async def stop(self) -> None:
        if self._task is None:
            return
        self._stop.set()
        try:
            await asyncio.wait_for(self._task, timeout=5.0)
        except asyncio.TimeoutError:
            self._task.cancel()
        self._task = None

    async def _loop(self) -> None:
        backoff = 1.0
        while not self._stop.is_set():
            try:
                async with aiomqtt.Client(
                    hostname=self._settings.MQTT_BROKER_HOST,
                    port=self._settings.MQTT_BROKER_PORT,
                    keepalive=60,
                ) as client:
                    await client.subscribe("devices/+/+")
                    _log.info(
                        "mqtt consumer connected to %s:%d",
                        self._settings.MQTT_BROKER_HOST,
                        self._settings.MQTT_BROKER_PORT,
                    )
                    backoff = 1.0
                    async for msg in client.messages:
                        if self._stop.is_set():
                            break
                        try:
                            await _on_message(self._loader, msg)
                        except Exception as e:
                            _log.exception("on_message error: %s", e)
            except asyncio.CancelledError:
                break
            except Exception as e:
                _log.warning(
                    "mqtt consumer error: %s; reconnect in %.1fs",
                    e,
                    backoff,
                )
                try:
                    await asyncio.wait_for(self._stop.wait(), timeout=backoff)
                except asyncio.TimeoutError:
                    pass
                backoff = min(backoff * 2, 30.0)


_consumer: Optional[Consumer] = None


def get_consumer() -> Consumer:
    global _consumer
    if _consumer is None:
        _consumer = Consumer()
    return _consumer
