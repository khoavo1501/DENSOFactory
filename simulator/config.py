from __future__ import annotations

import argparse
import os
from dataclasses import dataclass, field


@dataclass
class Config:
    broker_host: str = "emqx"
    broker_port: int = 1883
    username: str | None = None
    password: str | None = None

    device_ids: list[str] = field(
        default_factory=lambda: ["SIM_LINE_A_01", "SIM_LINE_A_02"]
    )

    telemetry_interval_s: float = 2.0
    status_interval_s: float = 30.0
    diag_interval_s: float = 300.0
    event_min_interval_s: float = 15.0
    event_max_interval_s: float = 45.0
    plc_comm_lost_probability: float = 0.05
    out_of_range_probability: float = 0.03

    fw_version: str = "1.0.3"
    hw_version: str = "STM32F103C8"

    seed: int | None = None

    @classmethod
    def from_env(cls, argv: list[str] | None = None) -> "Config":
        parser = argparse.ArgumentParser(
            prog="simulator",
            description="PLC/Gateway MQTT simulator (protocol v1)",
        )
        parser.add_argument(
            "--broker-host", default=os.environ.get("MQTT_BROKER_HOST", "emqx")
        )
        parser.add_argument(
            "--broker-port",
            type=int,
            default=int(os.environ.get("MQTT_BROKER_PORT", "1883")),
        )
        parser.add_argument(
            "--username", default=os.environ.get("MQTT_USERNAME") or None
        )
        parser.add_argument(
            "--password", default=os.environ.get("MQTT_PASSWORD") or None
        )
        parser.add_argument(
            "--device-id",
            action="append",
            default=None,
            help="Add a device id (repeatable). Overrides SIMULATOR_DEVICE_IDS.",
        )
        parser.add_argument(
            "--telemetry-interval",
            type=float,
            default=float(
                os.environ.get("SIMULATOR_TELEMETRY_INTERVAL", "2.0")
            ),
        )
        parser.add_argument(
            "--status-interval",
            type=float,
            default=float(os.environ.get("SIMULATOR_STATUS_INTERVAL", "30.0")),
        )
        parser.add_argument(
            "--diag-interval",
            type=float,
            default=float(os.environ.get("SIMULATOR_DIAG_INTERVAL", "300.0")),
        )
        parser.add_argument(
            "--fw-version",
            default=os.environ.get("SIMULATOR_FW_VERSION", "1.0.3"),
        )
        parser.add_argument(
            "--seed", type=int, default=None,
        )
        args = parser.parse_args(argv)

        env_ids = os.environ.get("SIMULATOR_DEVICE_IDS")
        if args.device_id:
            ids = args.device_id
        elif env_ids:
            ids = [s.strip() for s in env_ids.split(",") if s.strip()]
        else:
            ids = ["SIM_LINE_A_01", "SIM_LINE_A_02"]

        return cls(
            broker_host=args.broker_host,
            broker_port=args.broker_port,
            username=args.username,
            password=args.password,
            device_ids=ids,
            telemetry_interval_s=args.telemetry_interval,
            status_interval_s=args.status_interval,
            diag_interval_s=args.diag_interval,
            fw_version=args.fw_version,
            seed=args.seed,
        )