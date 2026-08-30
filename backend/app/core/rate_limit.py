"""In-memory rate limiter (sliding window).

Per Finding #7 (QA M1). Used for /api/auth/login. For multi-instance
production, replace with Redis-backed limiter.
"""
from __future__ import annotations

import os
import time
from collections import deque
from threading import Lock


class RateLimiter:
    def __init__(self, max_requests: int, window_sec: int) -> None:
        self._max = max_requests
        self._window = window_sec
        self._buckets: dict[str, deque[float]] = {}
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        """Return True if request is allowed; False if rate-limited."""
        now = time.time()
        with self._lock:
            dq = self._buckets.setdefault(key, deque())
            while dq and now - dq[0] > self._window:
                dq.popleft()
            if len(dq) >= self._max:
                return False
            dq.append(now)
            return True


def _is_test() -> bool:
    return os.environ.get("APP_ENV") == "test"


_login_limiter = RateLimiter(max_requests=5, window_sec=60)
_refresh_limiter = RateLimiter(max_requests=30, window_sec=60)


def check_login(key: str) -> bool:
    if _is_test():
        return True
    return _login_limiter.allow(key)


def check_refresh(key: str) -> bool:
    if _is_test():
        return True
    return _refresh_limiter.allow(key)
