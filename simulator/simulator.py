"""Simulator stub: publishes MQTT messages per payload_spec_v1.md.

This is a minimal skeleton for M1. A full simulator (with random walks,
LWT simulation, event injection) is the same file referenced by the spec.
For M1 we ship a runnable container that publishes a heartbeat + telemetry
every few seconds so end-to-end tests have data.
"""
from __future__ import annotations

import json
import logging
import os
import random
import signal
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt


_log = logging.getLogger("simulator")
logging.basicConfig(level=logging.INFO)


BROKER = os.environ.get("MQTT_BROKER_HOST", "emqx")
PORT = int(os.environ.get("MQTT_BROKER_PORT", "1883"))
DEVICE_IDS = os.environ.get(
    "SIMULATOR_DEVICE_IDS", "SIM_LINE_A_01,SIM_LINE_A_02"
).split(",")
TELEMETRY_INTERVAL = float(os.environ.get("SIMULATOR_TELEMETRY_INTERVAL", "2.0"))
STATUS_INTERVAL = float(os.environ.get("SIMULATOR_STATUS_INTERVAL", "30.0"))


def _now() -> int:
    return int(datetime.now(tz=timezone.utc).timestamp())


def _telemetry_payload(did: str) -> dict:
    return {
        "device_id": did,
        "ts": _now(),
        "type": "telemetry",
        "seq": int(time.time() * 1000) % (2**32 - 1),
        "fw": "1.0.0",
        "registers": {
            "hr_100": random.randint(0, 1000),
            "hr_101": random.randint(0, 1000),
            "co_0": random.choice([True, False]),
            "di_300": random.choice([True, False]),
        },
    }


def _status_payload(did: str) -> dict:
    return {
        "device_id": did,
        "ts": _now(),
        "type": "status",
        "state": "online",
        "uptime_s": int(time.time()),
    }


def _lwt_payload(did: str) -> dict:
    return {
        "device_id": did,
        "ts": 0,
        "type": "status",
        "state": "offline",
        "reason": "unexpected_disconnect",
    }


def main() -> None:
    client = mqtt.Client(client_id="simulator", clean_session=True)
    client.will_set(
        f"devices/{DEVICE_IDS[0]}/status",
        json.dumps(_lwt_payload(DEVICE_IDS[0])),
        qos=1,
        retain=True,
    )
    client.connect(BROKER, PORT, keepalive=60)

    last_telemetry = 0.0
    last_status = 0.0

    def _shutdown(*_):
        _log.info("shutting down")
        for did in DEVICE_IDS:
            client.publish(
                f"devices/{did}/status",
                json.dumps({**_status_payload(did), "state": "offline",
                            "reason": "planned_shutdown"}),
                qos=1,
                retain=True,
            )
        client.disconnect()
        raise SystemExit(0)

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    _log.info("simulator running; devices=%s", DEVICE_IDS)
    client.loop_start()
    try:
        while True:
            now = time.time()
            if now - last_telemetry >= TELEMETRY_INTERVAL:
                for did in DEVICE_IDS:
                    client.publish(
                        f"devices/{did}/telemetry",
                        json.dumps(_telemetry_payload(did)),
                        qos=1,
                        retain=False,
                    )
                last_telemetry = now
            if now - last_status >= STATUS_INTERVAL:
                for did in DEVICE_IDS:
                    client.publish(
                        f"devices/{did}/status",
                        json.dumps(_status_payload(did)),
                        qos=1,
                        retain=True,
                    )
                last_status = now
            time.sleep(0.1)
    finally:
        client.loop_stop()


if __name__ == "__main__":
    main()
