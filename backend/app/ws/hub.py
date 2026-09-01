"""WebSocket broadcast hub.

In-memory pub/sub for one backend instance. When Redis URL is set
(M9), publishes are mirrored to a Redis channel so other backend
instances also deliver the message to their local subscribers.
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
        self._bus = None  # set in start_bus()

    async def publish(self, channel: str, message: dict) -> None:
        # Local delivery
        for q in list(self._subs.get(channel, ())):
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                _log.warning("ws queue full, dropping message for %s", channel)
        # Cross-instance delivery via Redis (no-op if bus disabled)
        if self._bus is not None:
            try:
                await self._bus.publish(message)
            except Exception as e:
                _log.warning("bus publish failed: %s", e)

    async def dispatch_from_bus(self, message: dict) -> None:
        """Called by RedisBus when a message arrives from another instance.
        Same routing logic as publish but skips bus republish to avoid loop.
        """
        channel = message.get("device_id") or "*"
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


async def start_bus() -> None:
    """Start Redis pub/sub adapter and wire into the hub.

    Idempotent: calling multiple times is safe.
    """
    from app.ws.redis_bus import get_bus

    if _hub._bus is not None:
        return
    bus = get_bus()
    _hub._bus = bus
    await bus.start(_hub.dispatch_from_bus)


async def stop_bus() -> None:
    if _hub._bus is None:
        return
    await _hub._bus.stop()
    _hub._bus = None


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
