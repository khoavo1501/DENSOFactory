"""MQTT client wrapper: connect, LWT, publish loop, reconnect, shutdown.

Hard guarantees:
    - LWT payload on devices/{id}/status (retain=true, qos=1) — set BEFORE
      connect, so broker holds it if we crash (§3.2).
    - Graceful shutdown publishes status offline with reason="planned_shutdown"
      before disconnecting.
    - Auto-reconnect via paho-mqtt built-in loop.
    - Each device has its OWN client_id so the broker keeps per-device LWT
      (single client_id would clobber LWT and offline flags collide).
"""
from __future__ import annotations

import json
import logging
import random
import signal
import threading
import time
from typing import Any

import paho.mqtt.client as mqtt

from .config import Config
from .models import DeviceState
from .payloads import ip_for, mac_for, status_offline


_log = logging.getLogger("simulator.mqtt")


def topic_status(device_id: str) -> str:
    return f"devices/{device_id}/status"


def topic_telemetry(device_id: str) -> str:
    return f"devices/{device_id}/telemetry"


def topic_event(device_id: str) -> str:
    return f"devices/{device_id}/event"


def topic_info(device_id: str) -> str:
    return f"devices/{device_id}/info"


def topic_diag(device_id: str) -> str:
    return f"devices/{device_id}/diag"


class DeviceConnection:
    """Per-device MQTT connection with its own LWT.

    paho-mqtt.Client is single-connection per client instance; to give each
    gateway its own LWT we run one Client per device. They share a single
    network thread (paho's loop_start), so this is cheap.
    """

    def __init__(self, config: Config, device_id: str):
        self.config = config
        self.device_id = device_id
        self.client = mqtt.Client(
            client_id=f"sim-{device_id}",
            clean_session=True,
        )
        if config.username:
            self.client.username_pw_set(config.username, config.password)
        self.client.will_set(
            topic_status(device_id),
            json.dumps(status_offline(device_id, "unexpected_disconnect")),
            qos=1,
            retain=True,
        )
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.reconnect_delay_set(min_delay=1, max_delay=10)

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        if reason_code == 0:
            _log.info("[%s] connected", self.device_id)
        else:
            _log.warning(
                "[%s] connect failed: rc=%s", self.device_id, reason_code
            )

    def _on_disconnect(self, client, userdata, flags, reason_code, properties=None):
        _log.info(
            "[%s] disconnected rc=%s", self.device_id, reason_code
        )

    def connect(self) -> None:
        self.client.connect_async(
            self.config.broker_host, self.config.broker_port, keepalive=60
        )
        self.client.loop_start()

    def disconnect(self) -> None:
        try:
            self.client.disconnect()
        finally:
            self.client.loop_stop()

    def publish(
        self,
        topic: str,
        payload: dict[str, Any],
        qos: int,
        retain: bool,
    ) -> None:
        body = json.dumps(payload, separators=(",", ":"))
        info = self.client.publish(topic, body, qos=qos, retain=retain)
        if info.rc == mqtt.MQTT_ERR_SUCCESS:
            _log.debug("[%s] -> %s (%d B)", self.device_id, topic, len(body))
        else:
            _log.warning("[%s] publish queued rc=%s", self.device_id, info.rc)

    def planned_shutdown(self) -> None:
        """Send controlled offline status (retain=true) before disconnect."""
        payload = status_offline(self.device_id, "planned_shutdown")
        self.client.publish(
            topic_status(self.device_id),
            json.dumps(payload, separators=(",", ":")),
            qos=1,
            retain=True,
        ).wait_for_publish(timeout=2.0)


class SimulatorRunner:
    """Orchestrates: connect all devices, run publish loops, handle signals."""

    def __init__(self, config: Config, states: dict[str, DeviceState]):
        self.config = config
        self.states = states
        self.connections: dict[str, DeviceConnection] = {}
        self.stop_event = threading.Event()
        self.start_time = time.time()
        self.rng = random.Random(config.seed)
        self.last_telemetry: dict[str, float] = {d: 0.0 for d in states}
        self.last_status: dict[str, float] = {d: 0.0 for d in states}
        self.last_diag: dict[str, float] = {d: 0.0 for d in states}
        # mark uptime so status payload reflects real boot
        for s in states.values():
            s.started_at = self.start_time

    def connect_all(self) -> None:
        for did in self.states:
            conn = DeviceConnection(self.config, did)
            self.connections[did] = conn
            conn.connect()
        # small grace period for connections to complete (LWT is registered
        # before connect so it is in effect as soon as the broker accepts)
        time.sleep(0.5)

    def publish_info_once(self) -> None:
        from simulator import payloads as pm
        for did, state in self.states.items():
            payload = pm.info(state, ip_for(did), mac_for(did))
            self.connections[did].publish(
                topic_info(did), payload, qos=1, retain=True
            )
        _log.info("info published for %d devices", len(self.states))

    def install_signal_handlers(self) -> None:
        def _sig(_sig, _frame):
            _log.info("signal received, shutting down gracefully")
            self.stop_event.set()

        signal.signal(signal.SIGTERM, _sig)
        signal.signal(signal.SIGINT, _sig)

    def run(self) -> None:
        """Main publishing loop. Returns when stop_event is set."""
        from simulator import payloads as pm
        from simulator.events import EventInjector

        injectors: dict[str, EventInjector] = {
            did: EventInjector(self.rng, state)
            for did, state in self.states.items()
        }
        self.connect_all()
        self.install_signal_handlers()
        self.publish_info_once()

        try:
            while not self.stop_event.is_set():
                now = time.time()
                for did, state in self.states.items():
                    conn = self.connections[did]
                    snapshot: dict[str, Any] = {}

                    if now - self.last_telemetry[did] >= self.config.telemetry_interval_s:
                        snapshot = state.tick(self.rng)
                        conn.publish(
                            topic_telemetry(did),
                            pm.telemetry(state, snapshot),
                            qos=1,
                            retain=False,
                        )
                        state.tx_packets += 1
                        self.last_telemetry[did] = now
                        if state.all_online():
                            for plc in state.plcs:
                                plc.ok_count += 1
                                plc.last_ok_ts = int(now)

                    if now - self.last_status[did] >= self.config.status_interval_s:
                        conn.publish(
                            topic_status(did),
                            pm.status_online(state, now),
                            qos=1,
                            retain=True,
                        )
                        self.last_status[did] = now

                    if now - self.last_diag[did] >= self.config.diag_interval_s:
                        conn.publish(
                            topic_diag(did),
                            pm.diag(state, now),
                            qos=0,
                            retain=False,
                        )
                        self.last_diag[did] = now

                    ev, _side = injectors[did].tick(now, snapshot)
                    if ev is not None:
                        conn.publish(
                            topic_event(did),
                            ev,
                            qos=1,
                            retain=False,
                        )
                        state.tx_packets += 1

                time.sleep(0.1)
        finally:
            for conn in self.connections.values():
                conn.planned_shutdown()
                conn.disconnect()
            _log.info("simulator stopped cleanly")