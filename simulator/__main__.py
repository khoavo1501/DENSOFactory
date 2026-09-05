"""Entry point: `python -m simulator`."""
from __future__ import annotations

import logging
import sys

from .config import Config
from .mqtt_client import SimulatorRunner
from .registry import build_states


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
    )
    config = Config.from_env(argv if argv is not None else sys.argv[1:])
    log = logging.getLogger("simulator")
    log.info(
        "starting: broker=%s:%d devices=%s fw=%s",
        config.broker_host,
        config.broker_port,
        config.device_ids,
        config.fw_version,
    )
    states = build_states(
        config.device_ids,
        fw_version=config.fw_version,
        hw_version=config.hw_version,
    )
    runner = SimulatorRunner(config, states)
    try:
        runner.run()
    except KeyboardInterrupt:
        log.info("interrupted")
    return 0


if __name__ == "__main__":
    sys.exit(main())