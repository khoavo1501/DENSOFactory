"""Lightweight InfluxDB v2 client wrapper.

This module avoids hard-pinning a specific client lib; we use httpx against
the Influx v2 HTTP API. If the bucket is empty or the query fails we return
empty results so the API surface stays consistent.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional

import httpx

from app.core.config import get_settings


_log = logging.getLogger(__name__)


class InfluxClient:
    def __init__(self) -> None:
        s = get_settings()
        self._base = s.INFLUXDB_URL.rstrip("/")
        self._token = s.INFLUXDB_TOKEN
        self._org = s.INFLUXDB_ORG
        self._bucket = s.INFLUXDB_BUCKET

    def query(self, flux: str) -> list[dict[str, Any]]:
        if not self._token:
            _log.debug("INFLUXDB_TOKEN empty; returning empty result")
            return []
        try:
            with httpx.Client(timeout=10.0) as client:
                r = client.post(
                    f"{self._base}/api/v2/query",
                    params={"org": self._org},
                    headers={
                        "Authorization": f"Token {self._token}",
                        "Accept": "application/csv",
                        "Content-Type": "application/vnd.flux",
                    },
                    content=flux,
                )
                if r.status_code >= 400:
                    _log.warning(
                        "InfluxDB query %d: %s", r.status_code, r.text[:200]
                    )
                    return []
        except Exception as e:
            _log.warning("InfluxDB query failed: %s", e)
            return []

        return self._parse_csv(r.text)

    @staticmethod
    def _parse_csv(text: str) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        lines = [ln for ln in text.splitlines() if ln and not ln.startswith("#")]
        if not lines:
            return rows
        header = lines[0].split(",")
        for ln in lines[1:]:
            parts = ln.split(",")
            if len(parts) != len(header):
                continue
            rows.append(dict(zip(header, parts)))
        return rows


_client: Optional[InfluxClient] = None


def get_influx() -> InfluxClient:
    global _client
    if _client is None:
        _client = InfluxClient()
    return _client


def unix_to_iso(ts: int) -> str:
    return datetime.utcfromtimestamp(ts).isoformat() + "Z"
