"""Device state model with random walks for telemetry registers.

Each DeviceState owns:
    - Holding registers (hr_*), Input Registers (ir_*), Coils (co_*),
      Discrete Inputs (di_*) per docs/99_attachments/payload_spec_v1.md §2.2.
    - PLC list (Modbus slaves under this gateway).
    - Per-PLC stats for diag payload.
    - PLC connectivity map (bool per plc id).

Random walk: float registers drift around a target with Gaussian noise;
bool registers flip with small probability each tick.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any


@dataclass
class RegisterSpec:
    """Definition of a simulated register.

    kind: 'hr' | 'ir' | 'co' | 'di'
    addr: int (decimal Modbus address)
    value_type: 'int' | 'float' | 'bool'
    target: float   # mid-point for int/float random walk
    amplitude: float = 0.0  # ± amplitude around target
    min_v: int = 0
    max_v: int = 1000
    """

    kind: str
    addr: int
    value_type: str
    target: float = 0.0
    amplitude: float = 0.0
    min_v: int = 0
    max_v: int = 4294967295
    flip_prob: float = 0.05

    @property
    def key(self) -> str:
        return f"{self.kind}_{self.addr}"


DEFAULT_REGISTERS: list[RegisterSpec] = [
    RegisterSpec("hr", 100, "float", target=352, amplitude=20, min_v=0, max_v=1000),
    RegisterSpec("hr", 101, "float", target=315, amplitude=15, min_v=0, max_v=1000),
    RegisterSpec("hr", 102, "float", target=1450, amplitude=50, min_v=0, max_v=3000),
    RegisterSpec("ir", 200, "int", target=1234, amplitude=100, min_v=0, max_v=4294967295),
    RegisterSpec("co", 0, "bool", flip_prob=0.05),
    RegisterSpec("co", 1, "bool", flip_prob=0.02),
    RegisterSpec("di", 300, "bool", flip_prob=0.03),
    RegisterSpec("di", 301, "bool", flip_prob=0.03),
]


@dataclass
class PLC:
    id: int
    addr: int
    name: str
    online: bool = True
    ok_count: int = 0
    fail_count: int = 0
    last_ok_ts: int = 0
    avg_latency_ms: float = 12.0
    # Per-PLC register subset (a real gateway would only poll its own slaves)
    register_indices: list[int] = field(default_factory=list)


@dataclass
class DeviceState:
    device_id: str
    started_at: float
    registers: list[RegisterSpec] = field(default_factory=list)
    current: dict[str, Any] = field(default_factory=dict)
    plcs: list[PLC] = field(default_factory=list)
    tx_packets: int = 0
    tx_failures: int = 0
    mqtt_reconnect: int = 0
    seq: int = 0
    poll_cycle_ms: int = 120
    fw_version: str = "1.0.3"
    hw_version: str = "STM32F103C8"
    reset_reason: str = "POWER_ON"

    def init_default(self) -> None:
        self.registers = list(DEFAULT_REGISTERS)
        self.plcs = [
            PLC(id=1, addr=1, name=f"{self.device_id}_plc_1"),
            PLC(id=2, addr=2, name=f"{self.device_id}_plc_2"),
        ]
        for i, _ in enumerate(self.registers):
            self.plcs[i % len(self.plcs)].register_indices.append(i)
        for r in self.registers:
            if r.value_type == "bool":
                self.current[r.key] = False
            elif r.value_type == "int":
                self.current[r.key] = int(r.target)
            else:
                self.current[r.key] = int(r.target)

    def tick(self, rng: random.Random) -> dict[str, Any]:
        """Apply random walk; return new register snapshot.

        For hr_N / ir_N: 32-bit integer (0..4294967295) — server does scaling.
        For co_N / di_N: bool.
        """
        for r in self.registers:
            if r.value_type == "bool":
                if rng.random() < r.flip_prob:
                    self.current[r.key] = not self.current[r.key]
            elif r.value_type == "int":
                drift = rng.gauss(0, max(r.amplitude / 3, 1))
                val = self.current[r.key] + drift
                self.current[r.key] = int(max(r.min_v, min(r.max_v, val)))
            else:
                drift = rng.gauss(0, max(r.amplitude / 6, 1))
                val = self.current[r.key] + drift
                self.current[r.key] = int(max(r.min_v, min(r.max_v, val)))
        return dict(self.current)

    def next_seq(self) -> int:
        self.seq = (self.seq + 1) % (2**32 - 1)
        return self.seq

    def uptime_s(self, now: float) -> int:
        return int(now - self.started_at)

    def all_online(self) -> bool:
        return all(p.online for p in self.plcs)

    def any_offline(self) -> bool:
        return any(not p.online for p in self.plcs)

    def apply_firmware(self, fw_version: str, hw_version: str) -> None:
        self.fw_version = fw_version
        self.hw_version = hw_version