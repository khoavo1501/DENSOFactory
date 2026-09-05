"""PLC simulator: publishes MQTT messages per docs/99_attachments/payload_spec_v1.md.

Module structure:
    simulator/
        __init__.py
        __main__.py        # entry point: `python -m simulator`
        config.py          # env vars, CLI args
        models.py          # PLC / Gateway / DeviceState dataclasses + random walks
        payloads.py        # builders for 5 categories (telemetry/status/event/info/diag)
        events.py          # event injector (random PLC_COMM_LOST, VALUE_OUT_OF_RANGE, ...)
        mqtt_client.py     # MQTT connect + LWT + publish loop + graceful shutdown
        registry.py        # device registry (loaded from env + default profile)

Usage:
    python -m simulator                      # use env config
    python -m simulator --device-id FOO     # single device
    SIMULATOR_DEVICE_IDS=A,B,C python -m simulator
"""
from __future__ import annotations