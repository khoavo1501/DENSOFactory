"""Device registry: builds DeviceState objects for each configured id."""
from __future__ import annotations

import time

from .models import DeviceState


def build_states(
    device_ids: list[str], fw_version: str = "1.0.3", hw_version: str = "STM32F103C8"
) -> dict[str, DeviceState]:
    started = time.time()
    states: dict[str, DeviceState] = {}
    for did in device_ids:
        s = DeviceState(device_id=did, started_at=started)
        s.fw_version = fw_version
        s.hw_version = hw_version
        s.init_default()
        states[did] = s
    return states