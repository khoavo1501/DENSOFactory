"""Redis pub/sub bus for multi-instance backend (M9 / D-19).

When REDIS_URL is set, all backend instances share a Redis pub/sub channel
`iigw:ws` for WebSocket broadcast. Each instance:
- publishes to `iigw:ws` whenever a message would go to the local hub
- subscribes to `iigw:ws` and dispatches received messages to local
  in-memory hub subscribers (excluding messages this instance published,
  to avoid double-delivery).

When REDIS_URL is empty, the bus is a no-op (single-instance mode keeps
the existing in-memory hub behavior).
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Awaitable, Callable, Optional

from app.core.config import get_settings


_log = logging.getLogger(__name__)

CHANNEL = "iigw:ws"


class RedisBus:
    """Lazy-init Redis pub/sub adapter. Each instance has its own."""

    def __init__(self) -> None:
        self._settings = get_settings()
        self._url = self._settings.REDIS_URL
        self._instance_id = self._settings.INSTANCE_ID
        self._redis = None
        self._pubsub = None
        self._subscriber_task: Optional[asyncio.Task] = None
        self._on_message: Optional[Callable[[dict], Awaitable[None]]] = None
        self._connected = False

    @property
    def enabled(self) -> bool:
        return bool(self._url)

    async def start(self, on_message: Callable[[dict], Awaitable[None]]) -> None:
        """Connect + subscribe to channel; forward received msgs to on_message."""
        if not self.enabled:
            _log.info("RedisBus disabled (REDIS_URL not set); single-instance mode")
            return
        self._on_message = on_message
        try:
            from redis.asyncio import Redis

            self._redis = Redis.from_url(self._url, decode_responses=True)
            await self._redis.ping()
            self._pubsub = self._redis.pubsub()
            await self._pubsub.subscribe(CHANNEL)
            self._connected = True
            _log.info(
                "RedisBus connected to %s as instance=%s, channel=%s",
                self._url,
                self._instance_id,
                CHANNEL,
            )
            self._subscriber_task = asyncio.create_task(self._pump())
        except Exception as e:
            _log.error("RedisBus start failed: %s; bus disabled", e)
            self._connected = False
            self._redis = None
            self._pubsub = None

    async def stop(self) -> None:
        if not self._connected:
            return
        if self._subscriber_task:
            self._subscriber_task.cancel()
            try:
                await self._subscriber_task
            except (asyncio.CancelledError, Exception):
                pass
            self._subscriber_task = None
        if self._pubsub:
            try:
                await self._pubsub.unsubscribe(CHANNEL)
                await self._pubsub.close()
            except Exception:
                pass
            self._pubsub = None
        if self._redis:
            try:
                await self._redis.close()
            except Exception:
                pass
            self._redis = None
        self._connected = False
        _log.info("RedisBus stopped")

    async def publish(self, message: dict) -> None:
        """Publish a message to the shared channel (no-op if disabled)."""
        if not self._connected or self._redis is None:
            return
        envelope = {
            "origin": self._instance_id,
            "payload": message,
        }
        try:
            await self._redis.publish(CHANNEL, json.dumps(envelope))
        except Exception as e:
            _log.warning("RedisBus publish failed: %s", e)

    async def _pump(self) -> None:
        """Background task: read messages from pubsub and dispatch locally."""
        assert self._pubsub is not None
        try:
            async for raw in self._pubsub.listen():
                if raw.get("type") != "message":
                    continue
                data = raw.get("data")
                if not data:
                    continue
                try:
                    env = json.loads(data)
                except Exception:
                    continue
                if env.get("origin") == self._instance_id:
                    # Skip our own message to avoid double-delivery
                    continue
                payload = env.get("payload")
                if isinstance(payload, dict) and self._on_message:
                    try:
                        await self._on_message(payload)
                    except Exception as e:
                        _log.warning("RedisBus dispatch error: %s", e)
        except asyncio.CancelledError:
            return
        except Exception as e:
            _log.error("RedisBus pump crashed: %s", e)


_singleton: Optional[RedisBus] = None


def get_bus() -> RedisBus:
    global _singleton
    if _singleton is None:
        _singleton = RedisBus()
    return _singleton
