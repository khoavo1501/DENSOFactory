"""WebSocket broadcast hub.

For M1 we expose a simple in-memory pub/sub. The MQTT consumer publishes
events to this hub, and connected WebSocket clients receive them filtered
by device_id. Multi-instance broadcasting is a future-work concern.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

_log = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["ws"])


class Hub:
    def __init__(self) -> None:
        self._subs: dict[str, set[asyncio.Queue]] = {}

    async def publish(self, channel: str, message: dict) -> None:
        for q in list(self._subs.get(channel, ())):
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                _log.warning("ws queue full, dropping message for %s", channel)

    def subscribe(self, channel: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=256)
        self._subs.setdefault(channel, set()).add(q)
        return q

    def unsubscribe(self, channel: str, q: asyncio.Queue) -> None:
        if channel in self._subs:
            self._subs[channel].discard(q)


_hub = Hub()


def get_hub() -> Hub:
    return _hub


@router.websocket("/devices")
async def ws_devices(
    websocket: WebSocket,
    device_id: str = Query(default="*"),
) -> None:
    await websocket.accept()
    q = _hub.subscribe(device_id)
    try:
        while True:
            msg = await q.get()
            await websocket.send_text(json.dumps(msg))
    except WebSocketDisconnect:
        pass
    finally:
        _hub.unsubscribe(device_id, q)
