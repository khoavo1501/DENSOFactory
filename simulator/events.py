"""Random event injector.

Generates occasional events matching the closed enum in
docs/99_attachments/payload_spec_v1.md §4.2:

    PLC_COMM_LOST          (critical)
    PLC_COMM_RESTORED      (info)
    VALUE_OUT_OF_RANGE     (warning)
    SENSOR_FAULT           (warning)
    EMERGENCY_STOP         (critical)
    GATEWAY_REBOOT         (warning)
    WATCHDOG_RESET         (critical)
    POWER_ON               (info)
    W5500_LINK_DOWN        (critical)
    W5500_LINK_UP          (info)
    MQTT_DISCONNECTED      (warning)
    MQTT_RECONNECTED       (info)
    FIRMWARE_UPDATE_START  (info)
    FIRMWARE_UPDATE_END    (info)
    CONFIG_CHANGED         (info)
    BUFFER_OVERFLOW        (warning)

Simulator publishes a small subset that exercises the most-used events:
PLC_COMM_LOST / _RESTORED, VALUE_OUT_OF_RANGE, EMERGENCY_STOP.
"""
from __future__ import annotations

import random
from typing import Any

from .models import DeviceState
from .payloads import single_event


class EventInjector:
    """Stateful per-device injector: schedules and emits events."""

    def __init__(self, rng: random.Random, state: DeviceState):
        self.rng = rng
        self.state = state
        self.last_event_ts = 0.0
        self.next_event_in = self._schedule()

    def _schedule(self) -> float:
        return self.rng.uniform(15.0, 45.0)

    def tick(
        self, now: float, current_snapshot: dict[str, Any]
    ) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        """Returns (event_payload, side_effect_update) when an event fires.

        `side_effect_update` carries state changes applied to DeviceState
        (e.g. flip PLC online flag) so the caller can mutate after publish.
        """
        if now - self.last_event_ts < self.next_event_in:
            return None, None
        self.last_event_ts = now
        self.next_event_in = self._schedule()

        choice = self.rng.random()
        if choice < 0.5:
            return self._plc_comm_lost_or_restored(now)
        if choice < 0.85:
            return self._value_out_of_range(current_snapshot)
        return self._emergency_stop()

    def _plc_comm_lost_or_restored(
        self, now: float
    ) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        offline_plcs = [p for p in self.state.plcs if not p.online]
        online_plcs = [p for p in self.state.plcs if p.online]
        if offline_plcs and self.rng.random() < 0.6 and online_plcs:
            target = self.rng.choice(offline_plcs)
            target.online = True
            target.last_ok_ts = int(now)
            return (
                single_event(
                    self.state,
                    code="PLC_COMM_RESTORED",
                    severity="info",
                    message=f"PLC {target.id} ({target.name}) restored",
                    source=f"plc:{target.id}",
                    context={
                        "last_seen_ts": int(now),
                        "addr": target.addr,
                    },
                ),
                {"restored_plc_id": target.id},
            )
        if online_plcs:
            target = self.rng.choice(online_plcs)
            target.online = False
            target.fail_count += 1
            return (
                single_event(
                    self.state,
                    code="PLC_COMM_LOST",
                    severity="critical",
                    message=(
                        f"PLC {target.id} ({target.name}) timeout after 3 retries"
                    ),
                    source=f"plc:{target.id}",
                    context={
                        "last_seen_ts": target.last_ok_ts,
                        "retries": 3,
                    },
                ),
                {"lost_plc_id": target.id},
            )
        return None, None

    def _value_out_of_range(
        self, snapshot: dict[str, Any]
    ) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        numeric_keys = [
            k for k, v in snapshot.items()
            if (k.startswith("hr_") or k.startswith("ir_")) and isinstance(v, int)
        ]
        if not numeric_keys:
            return None, None
        key = self.rng.choice(numeric_keys)
        val = snapshot[key]
        return (
            single_event(
                self.state,
                code="VALUE_OUT_OF_RANGE",
                severity="warning",
                message=f"Register {key} out of expected range: {val}",
                source=f"register:{key}",
                context={"value": val, "expected_min": 0, "expected_max": 1000},
            ),
            {},
        )

    def _emergency_stop(
        self,
    ) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        return (
            single_event(
                self.state,
                code="EMERGENCY_STOP",
                severity="critical",
                message="Emergency stop button pressed",
                source="plc:0",
                context={"button_id": 0},
            ),
            {"emergency_stop": True},
        )