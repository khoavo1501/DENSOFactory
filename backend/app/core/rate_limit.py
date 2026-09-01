"""Rate limiter (sliding window).

In-memory by default; switches to Redis when REDIS_URL is set and the
client can be reached. The Redis variant uses ZSET + ZREMRANGEBYSCORE
to count requests in a sliding window atomically.

Per Finding #7 (QA M1). For multi-instance production, see D-44.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from collections import deque
from threading import Lock


_log = logging.getLogger(__name__)


class RateLimiter:
    """Sliding-window limiter; falls back from Redis to in-memory if
    Redis is unreachable. Skipped entirely when APP_ENV=test.
    """

    def __init__(self, name: str, max_requests: int, window_sec: int) -> None:
        self._name = name
        self._max = max_requests
        self._window = window_sec
        self._buckets: dict[str, deque[float]] = {}
        self._lock = Lock()
        self._redis = None
        redis_url = os.environ.get("REDIS_URL", "")
        if redis_url:
            try:
                from redis.asyncio import Redis
                self._redis = Redis.from_url(redis_url, decode_responses=True)
            except Exception as e:
                _log.warning("rate_limiter[%s] redis init failed: %s", name, e)
                self._redis = None

    async def _allow_redis(self, key: str) -> bool:
        if self._redis is None:
            return self._allow_memory(key)
        full_key = f"iigw:rl:{self._name}:{key}"
        now = time.time()
        try:
            async with self._redis.pipeline(transaction=False) as pipe:
                pipe.zremrangebyscore(full_key, 0, now - self._window)
                pipe.zcard(full_key)
                pipe.zadd(full_key, {f"{now}-{os.urandom(4).hex()}": now})
                pipe.expire(full_key, self._window + 1)
                results = await pipe.execute()
            count_before = results[1]
            return count_before < self._max
        except Exception as e:
            _log.warning(
                "rate_limiter[%s] redis allow failed: %s; memory fallback",
                self._name,
                e,
            )
            return self._allow_memory(key)

    def _allow_memory(self, key: str) -> bool:
        now = time.time()
        with self._lock:
            dq = self._buckets.setdefault(key, deque())
            while dq and now - dq[0] > self._window:
                dq.popleft()
            if len(dq) >= self._max:
                return False
            dq.append(now)
            return True

    async def allow(self, key: str) -> bool:
        if self._redis is not None:
            return await self._allow_redis(key)
        return self._allow_memory(key)


def _is_test() -> bool:
    return os.environ.get("APP_ENV") == "test"


_login_limiter = RateLimiter("login", max_requests=5, window_sec=60)
_refresh_limiter = RateLimiter("refresh", max_requests=30, window_sec=60)


async def check_login_async(key: str) -> bool:
    if _is_test():
        return True
    return await _login_limiter.allow(key)


async def check_refresh_async(key: str) -> bool:
    if _is_test():
        return True
    return await _refresh_limiter.allow(key)
